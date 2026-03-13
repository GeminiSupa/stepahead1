## Step Ahead Inclusive (Web App)

Next.js + Supabase web app for inclusive school operations: attendance, parent portal, therapy logs, IEP progress, behavior insights, and kids portfolios.

## Getting Started

### 1) Install

```bash
npm install
```

### 2) Configure environment variables

Create `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, required for `/api/admin/create-user`)

### 3) Create Supabase tables + RLS

Run the SQL in `supabase-schema.sql` in your Supabase SQL editor.

To make Sadia (Principal) the super admin, run:

```sql
update public.users
set role='admin', is_super_admin=true
where email='sadia@stepahead.com';
```

### 4) Run locally

```bash
npm run dev
```

Open `http://localhost:3000` and sign in at `/login`.

## Admin user creation (temporary passwords)

Super admin can create users at `/admin/staff`. This calls `POST /api/admin/create-user` which uses Supabase Service Role key on the server to:

- Create an Auth user with a **temporary password**
- Set `app_metadata.role` + `app_metadata.is_super_admin`
- Upsert the profile row in `public.users`

## Deploy on Vercel

Set the same environment variables in Vercel Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

