# IskolarMatch — Deployment

_Hosting and deployment approach for the Philippine scholarship discovery and matching tool, extracted from the MVP Development Plan._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Vercel + Supabase + Resend
**Status:** Draft v1 for build

---

## 3.3 Deployment

- Frontend + API on **Vercel**. DB/Auth/Storage on **Supabase**. Cron via **Supabase scheduled Edge Function** (or `pg_cron`). Email via **Resend**.

## Hosting summary (from ARCHITECTURE.md §4.2 Tech Stack)

```
Hosting: Vercel (app) + Supabase (data)
Reason:  Matches the owner's stack; deterministic core needs no heavy infra;
         Supabase RLS gives per-user security without a custom backend.
```
