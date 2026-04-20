# Manual-Onboarding Pivot — Build Report

**Date:** 2026-04-16
**Branch:** `feature/security-rbac-hardening`
**Scope:** All 4 phases of the pivot from public self-signup to manual SuperAdmin-driven onboarding.

---

## 1. What changed in one paragraph

Public signup is gone. You (the SuperAdmin) now manually onboard each broker company from a new `/superadmin` console after they pay you offline. Each broker is given a temporary password, logs in, and manages their own clients/properties/commissions plus their own team members up to a seat cap you set per contract. Subscription windows are extended via a manual payment ledger. Property listings are now shared inventory across each broker company (every team member sees them), while client books stay personal to each team member.

---

## 2. The 4 Phases

### Phase 1 — Schema + migration ✓

| Change | File |
|--------|------|
| Added 7 fields to `Company`: `subscriptionUntil`, `plan`, `seatLimit`, `monthlyFee`, `notes`, `onboardedBy`, plus 2 new indexes | `prisma/schema.prisma` |
| Added new `PaymentRecord` model (manual revenue ledger) | `prisma/schema.prisma` |
| Wrote backfill migration that copies `subscriptionExpiry` → `subscriptionUntil` and seeds defaults on every legacy Company doc (idempotent, `$exists: false` guards) | `scripts/migrations/001_seed_company_subscription_defaults.ts` |
| Registered new migration | `scripts/migrations/index.ts` |
| Pushed schema with `prisma db push` and ran `npm run migrate` — **19 Company docs backfilled** |  |

### Phase 2 — Removed public signup, fixed property visibility ✓

| Change | File |
|--------|------|
| Deleted `/signup` page | `app/(auth)/signup/` |
| Deleted signup API route | `app/api/auth/signup/route.ts` |
| Deleted email-verification API (no longer needed without self-signup) | `app/api/auth/verify-email/route.ts` |
| Removed `/signup` from public path lists; added `/superadmin/*` + `/api/superadmin/*` role gates | `middleware.ts` |
| Replaced all "Get Started / Sign Up / Start Free Trial" buttons with "Request Access" → `#contact` section with `mailto:` + WhatsApp links | `app/page.tsx` |
| Login page: "Don't have an account? Sign up" → "Request access" → `/#contact` | `app/(auth)/login/page.tsx` |
| **Property visibility:** removed `where.createdBy = userId` for team members in property list — properties are now shared inventory | `app/api/properties/route.ts` |
| Client visibility unchanged: team members still only see their OWN clients (their personal book) |  |
| One-off CLI to mint the first superadmin | `scripts/promote-superadmin.ts`, npm script `promote-superadmin` |

### Phase 3 — SuperAdmin Console ✓

**API routes:**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/superadmin/companies` | List all broker companies with seat usage, expiry warnings, MRR data |
| `POST /api/superadmin/companies` | Create a new Company + admin User in one shot, return temp password ONCE |
| `GET /api/superadmin/companies/[id]` | Full company detail: team roster, payment history, usage stats |
| `PATCH /api/superadmin/companies/[id]` | Edit plan, seats, monthly fee, expiry, status, notes |
| `DELETE /api/superadmin/companies/[id]` | Soft-suspend (sets status=suspended, bumps every user's tokenVersion → kills sessions). Data preserved. |
| `POST /api/superadmin/companies/[id]/reset-password` | Reset broker admin password, return new temp password ONCE |
| `GET /api/superadmin/payments` | List payment ledger, optional `?companyId=` filter, totals |
| `POST /api/superadmin/payments` | Record a payment, **auto-extend** `Company.subscriptionUntil` to `MAX(current, coversUntil)` |

**Pages:**

| Route | Purpose |
|-------|---------|
| `/superadmin` | Dashboard: MRR, total users vs seats, expiring/expired alerts, all-companies table |
| `/superadmin/companies` | Searchable + status-filtered companies list |
| `/superadmin/companies/new` | The core onboarding form. Creates company + admin, displays temp password ONCE with copy buttons + auto-generated welcome message text |
| `/superadmin/companies/[id]` | Full broker management: edit subscription/seats/fee, reset admin password, suspend, view team & recent payments |
| `/superadmin/payments` | Payment ledger with inline "record payment" form |

**Helpers added:**
- `lib/superadmin.ts` — `requireSuperAdmin()` auth gate + `generateTempPassword()` (e.g., `Mango-7421`)
- `lib/validations.ts` — added `createCompanyWithAdminSchema`, `updateCompanyBySuperAdminSchema`, `recordPaymentSchema`, `resetAdminPasswordSchema`

**Cross-cutting:**
- **Seat-cap enforcement** added to `app/api/users/route.ts` POST: when admin creates a `role:user`, count current seats vs `Company.seatLimit`, return 403 with `{ error: 'seat_limit_reached', current, limit }` if maxed out. Admins also blocked if company is suspended.
- **Suspended-company login block** added to `app/api/auth/login/route.ts`: suspended company users get `AUTH_ACCOUNT_INACTIVE` 403.
- **Login redirect** updated: `superadmin` → `/superadmin`, `admin` → `/admin/dashboard`, `user` → `/team/dashboard`.

### Phase 4 — Payment ledger + expiry alerts ✓

- `/superadmin/payments` page with date-defaulted form, company selector, method dropdown
- Recording a payment automatically pushes `Company.subscriptionUntil` forward (and flips status from `expired` → `active` if applicable)
- Dashboard widget on `/superadmin` highlights companies expired or expiring within 14 days

---

## 3. Data model — what your DB looks like now

```
SuperAdmin (you)
  │
  ├── Company (with subscriptionUntil, seatLimit, plan, monthlyFee, status, notes)
  │     ├── User (role: admin)         ← you create this
  │     │     └── User (role: user)... ← admin creates these (capped by seatLimit)
  │     ├── Client[]                    ← stamped with companyId + createdBy
  │     ├── Property[]                  ← stamped with companyId (SHARED across team)
  │     ├── Commission[]                ← stamped with companyId + clientId
  │     └── PaymentRecord[]             ← you record each payment, extends subscriptionUntil
  │
  └── audit_logs / activity_logs        ← every sensitive action recorded
```

**Tenant isolation:** every read/write is scoped by `companyId` taken from the JWT — no admin can see another admin's data.

---

## 4. Visibility rules (per your request)

| Resource | What `admin` sees | What `user` (team member) sees |
|----------|-------------------|-------------------------------|
| **Clients** | All clients in their company | ONLY clients they created (personal book) |
| **Properties** | All properties in their company | **All properties in their company** (shared inventory) ← changed |
| **Commissions** | All commissions in their company | ONLY commissions linked to their own clients |
| **Team management** | Can add/edit/remove team members up to `seatLimit` | Cannot |

---

## 5. How to run the new flow (operator manual)

### One-time: log in as SuperAdmin
1. Your account `singhpradhuman077@gmail.com` is now `role: superadmin`. **Log out and log back in** — your old JWT still says `role: admin`. The `tokenVersion` was bumped, so re-login is required.
2. After login you'll land on `/superadmin`.

### Onboard a new broker
1. Go to `/superadmin/companies/new`
2. Fill: company name, plan, seat limit, monthly fee, subscription end date, broker admin name/email/phone
3. Submit → system creates Company + admin User, returns a temp password
4. Click "Copy welcome message" (pre-formatted with login URL + email + temp password)
5. Send via WhatsApp/email to the broker
6. Go to `/superadmin/payments`, record what they paid you (this is what extends `subscriptionUntil`)

### Broker logs in
- They go to `/login`, paste credentials → land on `/admin/dashboard`
- They can manage clients/properties/commissions for their company
- They can add team members (under "Team") up to your `seatLimit` — system blocks the (n+1)th

### When subscription expires
- Once `subscriptionUntil < now`, login returns `AUTH_SUBSCRIPTION_EXPIRED` and redirects them to `/login?error=subscription_expired`
- You collect renewal payment offline → record it in `/superadmin/payments` → status flips back to `active` automatically, expiry pushes forward, broker can log in again

### When you need to suspend a customer
- `/superadmin/companies/[id]` → "Suspend" button
- Sets status to `suspended`, bumps every user's `tokenVersion` → all current sessions die
- Data is preserved; un-suspend by editing status back to `active`

### When a broker forgets their password
- `/superadmin/companies/[id]` → "Reset admin password" → copy the new temp password → send to broker

---

## 6. Files changed/created (full inventory)

### Created (16 files)

```
prisma/schema.prisma                                              (added Company fields + PaymentRecord)
scripts/migrations/001_seed_company_subscription_defaults.ts
scripts/promote-superadmin.ts
scripts/list-users.ts                       (diagnostic)
scripts/list-collections.ts                 (diagnostic)
scripts/reset-migration.ts                  (utility)
lib/superadmin.ts                           (auth gate + temp password gen)
app/api/superadmin/companies/route.ts
app/api/superadmin/companies/[id]/route.ts
app/api/superadmin/companies/[id]/reset-password/route.ts
app/api/superadmin/payments/route.ts
app/superadmin/layout.tsx
app/superadmin/page.tsx                     (overview dashboard)
app/superadmin/companies/page.tsx           (list)
app/superadmin/companies/new/page.tsx       (create + temp password reveal)
app/superadmin/companies/[id]/page.tsx      (detail + edit + suspend + reset)
app/superadmin/payments/page.tsx            (ledger + form)
BUILD_REPORT_PIVOT.md                       (this file)
```

### Modified (8 files)

```
prisma/schema.prisma            — Company fields, PaymentRecord, indexes
scripts/migrations/index.ts     — register migration 001
scripts/migrations/000_backfill_schema_fields.ts — fixed PascalCase collection names
package.json                    — added "migrate", "promote-superadmin", tsx devDep
middleware.ts                   — removed signup paths, added /superadmin gate
app/page.tsx                    — landing CTA → "Request Access" + #contact section
app/(auth)/login/page.tsx       — signup link → request-access
app/api/auth/login/route.ts     — superadmin redirect, suspended-company gate
app/api/properties/route.ts     — removed createdBy filter for team (shared inventory)
app/api/users/route.ts          — seat-cap enforcement on team-member create
lib/validations.ts              — superadmin Zod schemas
```

### Deleted (3 paths)

```
app/(auth)/signup/                      — public signup page
app/api/auth/signup/route.ts            — signup API
app/api/auth/verify-email/route.ts      — email verification (only needed for self-signup)
```

---

## 7. Build verification

- `npx prisma generate` ✓
- `npx prisma db push` ✓ (PaymentRecord collection + 4 new indexes created)
- `npm run migrate` ✓ (19 Company docs backfilled with subscription defaults)
- `npx tsc --noEmit` ✓ (zero TypeScript errors)
- `npm run build` ✓ (all 5 superadmin API routes + 4 superadmin pages compiled)

---

## 8. Things NOT done (intentional / out of scope)

| Item | Why |
|------|-----|
| Razorpay teardown | Left in place — you may still send payment links manually. Pruning the SDK + `/api/webhooks/razorpay` + `/api/subscriptions/*` can be done later in a 1-hour cleanup PR if you want. |
| Email "welcome with temp password" auto-send | The temp password is shown ONCE in the UI with copy buttons. Auto-sending it via `lib/email.ts` is a 30-min addition if you want it — current flow is more secure (you control delivery channel). |
| Cron emailing you about expiring companies | Dashboard widget already surfaces them at `/superadmin`. A daily cron in `app/api/cron/` is a small follow-up. |
| Per-tenant data export (ZIP of CSVs) | Discussed in design; not built yet. Each model already has its own `/api/.../export` endpoint scoped to the broker — superadmin-flavored cross-tenant export is the missing piece. |
| Impersonation ("login as broker for support") | Not built; can be added as a button on `/superadmin/companies/[id]` that mints a short-lived JWT for that admin user. |

---

## 9. Immediate next step for YOU

1. **Log out** of the app right now.
2. **Log back in** as `singhpradhuman077@gmail.com` — you'll be redirected to `/superadmin`.
3. Go to `/superadmin/companies` to see all 19 existing companies (now with seat/subscription fields backfilled).
4. Try `/superadmin/companies/new` to onboard a fresh broker end-to-end.
5. If anything looks off, open the broker's row, click "Suspend" to take them offline while you investigate.

---

## 10. The one-line summary

**You are now the gatekeeper.** Every login that ever happens in this system is for an account YOU created — and every rupee of revenue is logged in YOUR ledger.
