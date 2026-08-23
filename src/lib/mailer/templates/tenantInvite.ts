type TenantInviteTemplateInput = {
  inviteLink: string;
  propertyTitle?: string | null;
  unitLabel?: string | null;
  expiresAtIso?: string;
  isResend?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatExpiry(expiresAtIso?: string) {
  if (!expiresAtIso) {
    return "This invitation expires in 7 days.";
  }

  const parsed = new Date(expiresAtIso);
  if (Number.isNaN(parsed.getTime())) {
    return "This invitation expires in 7 days.";
  }

  return `This invitation expires on ${parsed.toLocaleDateString()}.`;
}

export function buildTenantInviteTemplate(input: TenantInviteTemplateInput) {
  const headline = input.isResend
    ? "Your rental invitation was refreshed"
    : "You are invited to join RentSecure";

  const propertyLine = input.propertyTitle
    ? `Property: ${input.propertyTitle}`
    : "Property details are available after you sign in.";
  const unitLine = input.unitLabel ? `Unit: ${input.unitLabel}` : "Unit: Assigned by landlord";
  const expiryLine = formatExpiry(input.expiresAtIso);

  const safeHeadline = escapeHtml(headline);
  const safePropertyLine = escapeHtml(propertyLine);
  const safeUnitLine = escapeHtml(unitLine);
  const safeExpiryLine = escapeHtml(expiryLine);
  const safeLink = escapeHtml(input.inviteLink);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">${safeHeadline}</h1>
      <p style="margin: 0 0 16px 0; color: #334155;">Use the secure link below to create your account password and complete your tenant onboarding.</p>
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: #f8fafc;">
        <p style="margin: 0 0 8px 0;"><strong>${safePropertyLine}</strong></p>
        <p style="margin: 0 0 8px 0;">${safeUnitLine}</p>
        <p style="margin: 0; color: #475569;">${safeExpiryLine}</p>
      </div>
      <p style="margin: 0 0 16px 0;">
        <a href="${safeLink}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 10px; padding: 12px 18px; font-weight: 600;">
          Accept Invitation
        </a>
      </p>
      <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;">If the button does not work, copy this URL into your browser:</p>
      <p style="margin: 0; word-break: break-word; font-size: 13px; color: #334155;">${safeLink}</p>
    </div>
  `;

  const text = [
    headline,
    "",
    "Use the secure link below to create your account password and complete your tenant onboarding.",
    "",
    propertyLine,
    unitLine,
    expiryLine,
    "",
    "Accept invitation:",
    input.inviteLink,
  ].join("\n");

  return {
    subject: input.isResend
      ? "Your RentSecure invitation was refreshed"
      : "You are invited to join RentSecure",
    html,
    text,
  };
}
