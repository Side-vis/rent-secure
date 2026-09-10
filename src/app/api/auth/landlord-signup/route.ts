import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendLandlordSignupConfirmationEmail } from "@/lib/mailer";
import { resolveCanonicalAppBaseUrl } from "@/lib/appUrl";

type SignupRequestBody = {
  email?: string;
  password?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignupRequestBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const redirectTo = `${resolveCanonicalAppBaseUrl()}/auth`;
    const { data, error: signupLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          redirectTo,
          data: {
            role: "landlord",
          },
        },
      });

    if (signupLinkError) {
      return NextResponse.json({ error: signupLinkError.message }, { status: 400 });
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json(
        { error: "Failed to generate confirmation link" },
        { status: 500 }
      );
    }

    await sendLandlordSignupConfirmationEmail({
      to: email,
      confirmLink: actionLink,
    });

    return NextResponse.json({
      message:
        "Check your email to confirm the account, then sign in to continue onboarding.",
    });
  } catch (error) {
    console.error("Failed to create landlord signup confirmation email", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}