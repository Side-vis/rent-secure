import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveCanonicalAppBaseUrl } from "@/lib/appUrl";
import { sendMagicLinkSignInEmail } from "@/lib/mailer";

type MagicLinkRequestBody = {
  email?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MagicLinkRequestBody;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const redirectTo = `${resolveCanonicalAppBaseUrl()}/auth`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
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
        { error: "Failed to generate sign-in link" },
        { status: 500 }
      );
    }

    await sendMagicLinkSignInEmail({
      to: email,
      signInLink: actionLink,
    });

    return NextResponse.json({
      message: "A secure sign-in link has been sent to your email.",
    });
  } catch (error) {
    console.error("Failed to send magic sign-in link", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}