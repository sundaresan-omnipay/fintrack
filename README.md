# FinTrack — Smart Finance Monitor

A production-grade personal finance tracker built with Next.js 15, Supabase, and Tailwind CSS. Deploy to Vercel in minutes.

---

## ✨ Features

- **Dashboard** — overview with daily/monthly charts, smart insights, recent transactions
- **Transactions** — log, filter, search, sort, and export spending (CSV)
- **Budget** — set per-category monthly limits with live progress bars
- **Analytics** — stacked bar charts, radar chart, category breakdowns, top spend days
- **Auth** — email/password login via Supabase Auth with RLS data isolation

---

## 🚀 Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd fintrack
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-schema.sql` (in the project root)
3. Go to **Settings → API** and copy:
   - `Project URL`
   - `anon` / `public` key

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

When prompted, add environment variables from `.env.local`.

### Option B — GitHub + Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**

### Supabase Auth Callback URL

In Supabase → **Authentication → URL Configuration**, add:
```
https://your-vercel-domain.vercel.app/auth/callback
```

---

## 🗂 Project structure

```
src/
├── app/
│   ├── auth/               # Login / signup page
│   ├── dashboard/
│   │   ├── page.tsx            # Dashboard overview
│   │   ├── DashboardClient.tsx
│   │   ├── transactions/       # Transaction log
│   │   ├── budget/             # Budget manager
│   │   ├── analytics/          # Charts & analytics
│   │   └── settings/           # Account settings
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── charts/             # Recharts wrappers
│   ├── layout/             # Sidebar
│   └── ui/                 # Reusable components
├── lib/
│   ├── supabase/           # Client + server helpers
│   └── utils.ts            # Formatters + helpers
├── types/
│   └── index.ts            # TypeScript types + category meta
└── middleware.ts            # Auth route protection
```

---

## 🔧 Tech stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (Postgres + Auth) |
| Styling | Tailwind CSS + CSS variables |
| Charts | Recharts |
| Animations | Framer Motion |
| Icons | Lucide React |
| Fonts | Syne (display) + DM Sans (body) |
| Deploy | Vercel |

---

## 📋 Database schema

See `supabase-schema.sql`. Two tables:
- `transactions` — all spending records, RLS-protected per user
- `budgets` — monthly budget limits per category, RLS-protected per user
