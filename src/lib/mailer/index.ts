import "server-only";
import nodemailer from "nodemailer";
import { buildTenantInviteTemplate } from "@/lib/mailer/templates/tenantInvite";
import { buildLandlordSignupConfirmationTemplate } from "@/lib/mailer/templates/landlordSignupConfirmation";
import { buildMagicLinkSignInTemplate } from "@/lib/mailer/templates/magicLinkSignIn";
import { buildPasswordResetTemplate } from "@/lib/mailer/templates/passwordReset";

type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendTenantInviteOptions = {
  to: string;
  inviteLink: string;
  propertyTitle?: string | null;
  unitLabel?: string | null;
  expiresAtIso?: string;
  isResend?: boolean;
};

type SendLandlordSignupConfirmationOptions = {
  to: string;
  confirmLink: string;
};

type SendMagicLinkSignInOptions = {
  to: string;
  signInLink: string;
};

type SendPasswordResetOptions = {
  to: string;
  resetLink: string;
};

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;

function validateSmtpEnv() {
  const missing: string[] = [];

  if (!smtpHost) missing.push("SMTP_HOST");
  if (!smtpUser) missing.push("SMTP_USER");
  if (!smtpPass) missing.push("SMTP_PASS");
  if (!smtpFrom) missing.push("SMTP_FROM");

  if (missing.length > 0) {
    throw new Error(`Missing SMTP env vars: ${missing.join(", ")}`);
  }
}

function getTransporter() {
  validateSmtpEnv();

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

export async function sendMail(options: SendMailOptions) {
  const transporter = getTransporter();

  return transporter.sendMail({
    from: smtpFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function sendTenantInviteEmail(options: SendTenantInviteOptions) {
  const template = buildTenantInviteTemplate({
    inviteLink: options.inviteLink,
    propertyTitle: options.propertyTitle,
    unitLabel: options.unitLabel,
    expiresAtIso: options.expiresAtIso,
    isResend: options.isResend,
  });

  return sendMail({
    to: options.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendLandlordSignupConfirmationEmail(
  options: SendLandlordSignupConfirmationOptions
) {
  const template = buildLandlordSignupConfirmationTemplate({
    confirmLink: options.confirmLink,
  });

  return sendMail({
    to: options.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendMagicLinkSignInEmail(options: SendMagicLinkSignInOptions) {
  const template = buildMagicLinkSignInTemplate({
    signInLink: options.signInLink,
  });

  return sendMail({
    to: options.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendPasswordResetEmail(options: SendPasswordResetOptions) {
  const template = buildPasswordResetTemplate({
    resetLink: options.resetLink,
  });

  return sendMail({
    to: options.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
