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

Add the variables from `.env.example` in Pages → Settings → Environment variables. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are browser-safe public values. `SUPABASE_URL` should contain the same Glyph project URL, but is separately named because Cloudflare Functions read server-side bindings. `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` are server-only.

Stripe setup is optional: when `STRIPE_PRICE_ID` is empty, QuickCode creates the `$5.99/month` recurring price inline during Checkout. No Stripe Product or Price needs to be created first. If you later add `STRIPE_PRICE_ID`, Checkout will use that explicit recurring price. Do not put a Stripe secret key or Supabase service-role key in any `VITE_` variable.

## QuickCode access model

QuickCode does not alter Glyph's existing tables. It uses `qc_subscriptions`, `qc_dynamic_codes`, and `qc_scan_log`. Free accounts can create static codes only. Paid accounts must have an active or trialing Stripe subscription before the dynamic-code API, paid customization, or analytics access is allowed. The API enforces this independently of the UI.

## Data model

Create these Supabase tables with RLS enabled:

```sql
create table dynamic_codes (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users not null, redirect_slug text unique not null, current_destination_url text not null, label text not null, created_at timestamptz default now());
create table scan_log (id bigint generated always as identity primary key, dynamic_code_id uuid references dynamic_codes on delete cascade not null, scanned_at timestamptz default now());
```

The redirect function inserts only `dynamic_code_id` and `scanned_at`; no request headers, IPs, user agents, or fingerprint data are stored.

## Routes

`/`, `/generator`, `/pricing`, `/about`, `/dashboard`, and the seven `/qr-code-for/*` landing pages are implemented. `public/sitemap.xml`, `public/robots.txt`, and `public/llms.txt` are included for crawlers.
