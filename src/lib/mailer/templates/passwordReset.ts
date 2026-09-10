type PasswordResetTemplateInput = {
  resetLink: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPasswordResetTemplate(input: PasswordResetTemplateInput) {
  const safeLink = escapeHtml(input.resetLink);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">Reset your RentSecure password</h1>
      <p style="margin: 0 0 16px 0; color: #334155;">
        We received a request to reset your password. Use this secure link to set a new password.
      </p>
      <p style="margin: 0 0 16px 0;">
        <a href="${safeLink}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 10px; padding: 12px 18px; font-weight: 600;">
          Reset Password
        </a>
      </p>
      <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;">If you did not request this, you can ignore this email.</p>
      <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;">If the button does not work, copy this URL into your browser:</p>
      <p style="margin: 0; word-break: break-word; font-size: 13px; color: #334155;">${safeLink}</p>
    </div>
  `;

  const text = [
    "Reset your RentSecure password",
    "",
    "We received a request to reset your password. Use this secure link to set a new password.",
    "",
    "Reset link:",
    input.resetLink,
  ].join("\n");

  return {
    subject: "Reset your RentSecure password",
    html,
    text,
  };
}