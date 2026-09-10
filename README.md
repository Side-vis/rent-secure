# RentSecure

RentSecure is a Next.js (App Router) TypeScript project with Tailwind CSS, Framer Motion, and Supabase client setup.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

## Environment Variables

Copy the template and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Optional:

- `EMAIL_PROVIDER_MODE` (`nodemailer` by default, `supabase` for fallback delivery)
- `NEXT_PUBLIC_APP_URL` (canonical app URL used in auth/invite email redirects, for example `https://10antscore.com`)
- `APP_BASE_URL` (server-side fallback app URL for outbound auth links)

## Custom Signup Confirmation Email

Landlord signup confirmation emails are sent through Nodemailer via `POST /api/auth/landlord-signup`.
The API generates a secure Supabase signup action link and sends a custom HTML template from `src/lib/mailer/templates/landlordSignupConfirmation.ts`.

## Full Branded Auth Emails

The app now sends these auth emails through Nodemailer with custom templates:

- Landlord signup confirmation: `POST /api/auth/landlord-signup`
- Passwordless sign-in link: `POST /api/auth/magic-link`
- Password reset link: `POST /api/auth/password-reset`
- Tenant invitation: `POST /api/landlord/invitations` (existing flow)

Template sources:

- `src/lib/mailer/templates/landlordSignupConfirmation.ts`
- `src/lib/mailer/templates/magicLinkSignIn.ts`
- `src/lib/mailer/templates/passwordReset.ts`
- `src/lib/mailer/templates/tenantInvite.ts`

## Supabase Auth URL Settings

For live email confirmations and invite links, update your Supabase project settings:

1. Set Site URL to `https://10antscore.com`.
2. Add your live redirect URLs to the redirect allow-list.
3. Keep localhost redirects only in development projects.

Recommended redirect allow-list entries:

- `https://10antscore.com/**`
- `https://10antscore.com/auth`
- `https://10antscore.com/auth/invite`
- `https://10antscore.com/auth/reset`

## Routes

- `/` and `/landing`
- `/auth`
- `/dashboards/tenant`
- `/dashboards/landlord`
- `/dashboards/investor`
- `/dashboards/admin`
