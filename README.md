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

## Routes

- `/` and `/landing`
- `/auth`
- `/dashboards/tenant`
- `/dashboards/landlord`
- `/dashboards/investor`
- `/dashboards/admin`
