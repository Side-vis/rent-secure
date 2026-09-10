import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveCanonicalAppBaseUrl } from "@/lib/appUrl";
import { sendPasswordResetEmail } from "@/lib/mailer";

type PasswordResetRequestBody = {
  email?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PasswordResetRequestBody;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const redirectTo = `${resolveCanonicalAppBaseUrl()}/auth/reset`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json(
        { error: "Failed to generate reset link" },
        { status: 500 }
      );
    }

    await sendPasswordResetEmail({
      to: email,
      resetLink: actionLink,
    });

    return NextResponse.json({
      message: "A password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("Failed to send password reset link", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}