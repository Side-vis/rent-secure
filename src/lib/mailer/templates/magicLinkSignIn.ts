type MagicLinkSignInTemplateInput = {
  signInLink: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildMagicLinkSignInTemplate(input: MagicLinkSignInTemplateInput) {
  const safeLink = escapeHtml(input.signInLink);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">Sign in to RentSecure</h1>
      <p style="margin: 0 0 16px 0; color: #334155;">
        Use this secure one-time link to access your account without entering your password.
      </p>
      <p style="margin: 0 0 16px 0;">
        <a href="${safeLink}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 10px; padding: 12px 18px; font-weight: 600;">
          Sign In Securely
        </a>
      </p>
      <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;">If the button does not work, copy this URL into your browser:</p>
      <p style="margin: 0; word-break: break-word; font-size: 13px; color: #334155;">${safeLink}</p>
    </div>
  `;

  const text = [
    "Sign in to RentSecure",
    "",
    "Use this secure one-time link to access your account without entering your password.",
    "",
    "Sign in link:",
    input.signInLink,
  ].join("\n");

  return {
    subject: "Your secure RentSecure sign-in link",
    html,
    text,
  };
}