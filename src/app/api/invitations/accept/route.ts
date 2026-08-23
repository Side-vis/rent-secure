import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type AcceptBody = {
  token?: string;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase configuration" },
        { status: 500 }
      );
    }

    const bearer = getBearerToken(request);
    if (!bearer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearer}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AcceptBody;
    const rawToken = body.token?.trim();

    if (!rawToken) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(rawToken);
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("tenant_invitations")
      .select(
        "id, landlord_id, property_id, tenant_email, tenant_user_id, unit_label, status, expires_at"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status}` },
        { status: 409 }
      );
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("tenant_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 410 }
      );
    }

    const emailMatch =
      !!user.email && user.email.toLowerCase() === invitation.tenant_email.toLowerCase();
    const idMatch = invitation.tenant_user_id === user.id;

    if (!emailMatch && !idMatch) {
      return NextResponse.json(
        { error: "This invite is for a different email address" },
        { status: 403 }
      );
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile && existingProfile.role !== "tenant") {
      return NextResponse.json(
        {
          error:
            "Your account is not a tenant account. Sign in with a tenant email to accept this invite.",
        },
        { status: 409 }
      );
    }

    const { error: upsertProfileError } = await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      role: "tenant",
      email: user.email || invitation.tenant_email,
    });

    if (upsertProfileError) {
      return NextResponse.json(
        { error: upsertProfileError.message },
        { status: 500 }
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updateInviteError } = await supabaseAdmin
      .from("tenant_invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        tenant_user_id: user.id,
      })
      .eq("id", invitation.id);

    if (updateInviteError) {
      return NextResponse.json(
        { error: updateInviteError.message },
        { status: 500 }
      );
    }

    const { data: existingTenancies, error: findTenancyError } = await supabaseAdmin
      .from("tenancies")
      .select("id")
      .eq("invitation_id", invitation.id)
      .limit(1);

    if (findTenancyError) {
      return NextResponse.json(
        { error: findTenancyError.message },
        { status: 500 }
      );
    }

    const existingTenancyId = existingTenancies?.[0]?.id;
    const tenancyPayload = {
      invitation_id: invitation.id,
      landlord_id: invitation.landlord_id,
      tenant_user_id: user.id,
      property_id: invitation.property_id,
      unit_label: invitation.unit_label,
      status: "active",
      start_date: new Date().toISOString().split("T")[0],
    };

    const { error: tenancyError } = existingTenancyId
      ? await supabaseAdmin
          .from("tenancies")
          .update(tenancyPayload)
          .eq("id", existingTenancyId)
      : await supabaseAdmin.from("tenancies").insert(tenancyPayload);

    if (tenancyError) {
      return NextResponse.json(
        { error: tenancyError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invitation accepted. Your rental is now available in dashboard.",
    });
  } catch (error) {
    console.error("Failed to accept invitation", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
