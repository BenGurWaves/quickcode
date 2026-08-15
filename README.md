# QuickCode

QuickCode is a React/Vite QR-code generator for static codes and editable dynamic redirects. The public generator works without authentication; production persistence and billing are designed for Cloudflare Pages Functions + Supabase + Stripe Checkout.

## Stack

- React, TypeScript, Vite, React Router
- QR generation with the portable `qrcode` package
- Cloudflare Pages / Workers for hosting and server-side functions
- Supabase Auth + Postgres REST API for dynamic codes and timestamp-only scan logs
- Stripe Checkout for the paid tier

## Local setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill only the public Supabase values for the browser. Keep service-role and Stripe secrets server-side in Cloudflare Pages environment variables.

```bash
npm run dev
```

## Checks

```bash
npm run typecheck
```

```bash
npm run build
```

## Cloudflare deployment

Build command: `npm run build`  
Output directory: `dist`

Cloudflare Pages project: https://quickcode-b4y.pages.dev/

Add the variables from `.env.example` in Pages → Settings → Environment variables. `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_PRICE_ID` are server-only and must never be prefixed with `VITE_`.

## Data model

Create these Supabase tables with RLS enabled:

```sql
create table dynamic_codes (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users not null, redirect_slug text unique not null, current_destination_url text not null, label text not null, created_at timestamptz default now());
create table scan_log (id bigint generated always as identity primary key, dynamic_code_id uuid references dynamic_codes on delete cascade not null, scanned_at timestamptz default now());
```

The redirect function inserts only `dynamic_code_id` and `scanned_at`; no request headers, IPs, user agents, or fingerprint data are stored.

## Routes

`/`, `/generator`, `/pricing`, `/about`, `/dashboard`, and the seven `/qr-code-for/*` landing pages are implemented. `public/sitemap.xml`, `public/robots.txt`, and `public/llms.txt` are included for crawlers.
