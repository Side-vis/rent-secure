import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTenantInviteEmail } from "@/lib/mailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type InviteBody = {
  propertyId?: string;
  tenantEmail?: string;
  unitLabel?: string;
};

type InviteRepairBody = {
  invitationId?: string;
  action?: "resend" | "force_relink";
};

type ExistingTenantIdentity = {
  id: string;
  role: string;
  email: string | null;
};

type InviteEmailPayload = {
  tenantEmail: string;
  redirectTo: string;
  propertyTitle?: string | null;
  unitLabel?: string | null;
  expiresAtIso?: string;
  isResend?: boolean;
};

function createTokenPair() {
  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

async function resolveExistingTenantByEmail(tenantEmail: string) {
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, email")
    .ilike("email", tenantEmail)
    .maybeSingle();

  let existingTenant: ExistingTenantIdentity | null =
    (existingProfile as ExistingTenantIdentity | null) ?? null;

  if (!existingTenant) {
    const { data: listedUsers, error: listUsersError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });

    if (listUsersError) {
      throw new Error(listUsersError.message);
    }

    const matchedAuthUser =
      listedUsers?.users?.find(
        (candidate) => candidate.email?.toLowerCase() === tenantEmail
      ) ?? null;

    if (matchedAuthUser) {
      const metadataRole =
        typeof matchedAuthUser.user_metadata?.role === "string"
          ? matchedAuthUser.user_metadata.role
          : "tenant";

      existingTenant = {
        id: matchedAuthUser.id,
        role: metadataRole,
        email: matchedAuthUser.email ?? tenantEmail,
      };
    }
  }

  return existingTenant;
}

async function dispatchInvitationEmail(payload: InviteEmailPayload) {
  const providerMode = (process.env.EMAIL_PROVIDER_MODE || "nodemailer").toLowerCase();

  if (providerMode === "supabase") {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      payload.tenantEmail,
      {
        redirectTo: payload.redirectTo,
        data: {
          role: "tenant",
        },
      }
    );

    return {
      error,
      providerMode,
    };
  }

  const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: payload.tenantEmail,
    options: {
      redirectTo: payload.redirectTo,
      data: {
        role: "tenant",
      },
    },
  });

  if (linkError) {
    return {
      error: linkError,
      providerMode,
    };
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    return {
      error: new Error("Supabase did not return an auth action link"),
      providerMode,
    };
  }

  try {
    await sendTenantInviteEmail({
      to: payload.tenantEmail,
      inviteLink: actionLink,
      propertyTitle: payload.propertyTitle,
      unitLabel: payload.unitLabel,
      expiresAtIso: payload.expiresAtIso,
      isResend: payload.isResend,
    });

    return {
      error: null,
      providerMode,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Failed to send invitation email"),
      providerMode,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase configuration" },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as InviteBody;
    const propertyId = body.propertyId?.trim();
    const tenantEmail = body.tenantEmail?.trim().toLowerCase();
    const unitLabel = body.unitLabel?.trim() || null;

    if (!propertyId || !tenantEmail) {
      return NextResponse.json(
        { error: "propertyId and tenantEmail are required" },
        { status: 400 }
      );
    }

    const [{ data: landlordProfile }, { data: property, error: propertyError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("properties")
          .select("id, title, owner_id, landlord_id")
          .eq("id", propertyId)
          .maybeSingle(),
      ]);

    if (!landlordProfile || landlordProfile.role !== "landlord") {
      return NextResponse.json(
        { error: "Only landlords can send tenant invitations" },
        { status: 403 }
      );
    }

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const ownsProperty =
      property.owner_id === user.id || property.landlord_id === user.id;
    if (!ownsProperty) {
      return NextResponse.json(
        { error: "You can only invite tenants to your own properties" },
        { status: 403 }
      );
    }

    if (unitLabel) {
      const [{ data: matchingUnit, error: matchingUnitError }, { data: activeTenancy }] =
        await Promise.all([
          supabaseAdmin
            .from("property_units")
            .select("id, is_available")
            .eq("property_id", propertyId)
            .ilike("unit_number", unitLabel)
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from("tenancies")
            .select("id")
            .eq("property_id", propertyId)
            .eq("status", "active")
            .ilike("unit_label", unitLabel)
            .limit(1)
            .maybeSingle(),
        ]);

      if (matchingUnitError) {
        return NextResponse.json(
          { error: matchingUnitError.message },
          { status: 500 }
        );
      }

      if (!matchingUnit) {
        return NextResponse.json(
          { error: "Selected unit was not found for this property" },
          { status: 404 }
        );
      }

      if (!matchingUnit.is_available) {
        return NextResponse.json(
          { error: "Selected unit is not marked as available" },
          { status: 409 }
        );
      }

      if (activeTenancy) {
        return NextResponse.json(
          { error: "Selected unit is already assigned to an active tenancy" },
          { status: 409 }
        );
      }

      const { data: pendingUnitInvite } = await supabaseAdmin
        .from("tenant_invitations")
        .select("id")
        .eq("property_id", propertyId)
        .eq("status", "pending")
        .ilike("unit_label", unitLabel)
        .limit(1)
        .maybeSingle();

      if (pendingUnitInvite) {
        return NextResponse.json(
          { error: "Selected unit already has a pending invitation" },
          { status: 409 }
        );
      }
    }

    const { data: existingPending } = await supabaseAdmin
      .from("tenant_invitations")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_email", tenantEmail)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 409 }
      );
    }

    const existingTenant = await resolveExistingTenantByEmail(tenantEmail);

    if (existingTenant && existingTenant.role !== "tenant") {
      return NextResponse.json(
        {
          error:
            "This email already belongs to a non-tenant account. Invite a tenant email instead.",
        },
        { status: 409 }
      );
    }

    if (existingTenant) {
      const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert({
        id: existingTenant.id,
        role: "tenant",
        email: existingTenant.email || tenantEmail,
      });

      if (profileUpsertError) {
        return NextResponse.json(
          { error: profileUpsertError.message },
          { status: 500 }
        );
      }
    }

    const { rawToken, tokenHash } = createTokenPair();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("tenant_invitations")
      .insert({
        landlord_id: user.id,
        property_id: propertyId,
        tenant_email: tenantEmail,
        tenant_user_id: existingTenant?.id ?? null,
        unit_label: unitLabel,
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: "pending",
      })
      .select("id, status, tenant_email, property_id, unit_label, expires_at")
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: inviteError?.message || "Failed to create invitation" },
        { status: 500 }
      );
    }

    if (existingTenant?.role === "tenant") {
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
        landlord_id: user.id,
        tenant_user_id: existingTenant.id,
        property_id: propertyId,
        unit_label: unitLabel,
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

      await supabaseAdmin
        .from("tenant_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          tenant_user_id: existingTenant.id,
        })
        .eq("id", invitation.id);

      return NextResponse.json({
        mode: "existing-tenant",
        message: "Tenant exists and was assigned successfully.",
        invitationId: invitation.id,
      });
    }

    const redirectTo = `${request.nextUrl.origin}/auth/invite?token=${rawToken}`;
    const { error: authInviteError } = await dispatchInvitationEmail({
      tenantEmail,
      redirectTo,
      propertyTitle: property.title,
      unitLabel,
      expiresAtIso: expiresAt,
      isResend: false,
    });

    if (authInviteError) {
      return NextResponse.json(
        {
          error:
            "Invitation was created, but email delivery failed. You can resend shortly.",
          detail: authInviteError.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      mode: "new-tenant",
      message: "Invitation email sent successfully.",
      invitationId: invitation.id,
      propertyTitle: property.title,
    });
  } catch (error) {
    console.error("Failed to create tenant invitation", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase configuration" },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as InviteRepairBody;
    const invitationId = body.invitationId?.trim();
    const action = body.action;

    if (!invitationId || !action) {
      return NextResponse.json(
        { error: "invitationId and action are required" },
        { status: 400 }
      );
    }

    if (action !== "resend" && action !== "force_relink") {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const [{ data: landlordProfile }, { data: invitation, error: invitationError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("tenant_invitations")
          .select(
            "id, landlord_id, property_id, tenant_email, tenant_user_id, unit_label, status"
          )
          .eq("id", invitationId)
          .maybeSingle(),
      ]);

    if (!landlordProfile || landlordProfile.role !== "landlord") {
      return NextResponse.json(
        { error: "Only landlords can manage invitations" },
        { status: 403 }
      );
    }

    if (invitationError || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.landlord_id !== user.id) {
      return NextResponse.json(
        { error: "You can only manage your own invitations" },
        { status: 403 }
      );
    }

    const existingTenant = await resolveExistingTenantByEmail(
      invitation.tenant_email.toLowerCase()
    );

    if (existingTenant && existingTenant.role !== "tenant") {
      return NextResponse.json(
        {
          error:
            "This invitation email belongs to a non-tenant account and cannot be linked.",
        },
        { status: 409 }
      );
    }

    const tenantUserId = existingTenant?.id ?? invitation.tenant_user_id ?? null;

    if (tenantUserId) {
      const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert({
        id: tenantUserId,
        role: "tenant",
        email: existingTenant?.email || invitation.tenant_email,
      });

      if (profileUpsertError) {
        return NextResponse.json(
          { error: profileUpsertError.message },
          { status: 500 }
        );
      }
    }

    if (action === "force_relink") {
      if (!tenantUserId) {
        return NextResponse.json(
          {
            error:
              "No tenant account found for this email yet. Use Resend invite so they can create/sign in first.",
          },
          { status: 409 }
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
        tenant_user_id: tenantUserId,
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

      const { error: updateInviteError } = await supabaseAdmin
        .from("tenant_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          tenant_user_id: tenantUserId,
        })
        .eq("id", invitation.id);

      if (updateInviteError) {
        return NextResponse.json(
          { error: updateInviteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Invite repaired and tenant tenancy linked successfully.",
      });
    }

    const { rawToken, tokenHash } = createTokenPair();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: refreshInviteError } = await supabaseAdmin
      .from("tenant_invitations")
      .update({
        status: "pending",
        accepted_at: null,
        revoked_at: null,
        token_hash: tokenHash,
        expires_at: expiresAt,
        tenant_user_id: tenantUserId,
      })
      .eq("id", invitation.id);

    if (refreshInviteError) {
      return NextResponse.json(
        { error: refreshInviteError.message },
        { status: 500 }
      );
    }

    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("title")
      .eq("id", invitation.property_id)
      .maybeSingle();

    const redirectTo = `${request.nextUrl.origin}/auth/invite?token=${rawToken}`;
    const { error: authInviteError } = await dispatchInvitationEmail({
      tenantEmail: invitation.tenant_email,
      redirectTo,
      propertyTitle: property?.title ?? null,
      unitLabel: invitation.unit_label,
      expiresAtIso: expiresAt,
      isResend: true,
    });

    if (authInviteError) {
      return NextResponse.json(
        {
          error:
            "Invitation was refreshed, but email delivery failed. Retry shortly.",
          detail: authInviteError.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: "Invitation resent successfully.",
    });
  } catch (error) {
    console.error("Failed to repair invitation", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
