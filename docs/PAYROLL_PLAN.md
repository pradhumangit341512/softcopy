# HR / Payroll & Salary-Slip Plan — Research & Design Report (v2)

> Status: **Research / design only — not yet implemented.**
> Updated: 2026-06-09 (v2 adds Attendance/absence deductions + Admin config fields)
> Author: engineering review of the existing codebase + proposed design.

## Executive summary

A new HR/Payroll capability where Admin/HR sets each team member's **base salary**,
**per-absent-day deduction**, and **commission rate per deal**; a member's deal
commissions **auto-add** and their **absences auto-deduct** for the month; and at
**month-end** the member **downloads a salary slip (PDF)** showing
`base + commissions − absence deductions`. Admin manages everything.

**Key finding:** ~70% of the hard parts already exist. The `Commission` model (with
per-user `commissionAmount`, `commissionPercentage`, `paidStatus`, and `CommissionSplit`
across teammates), plan/feature gating, role-based access scoping, and jsPDF generation
are all in place. The genuinely new pieces are: **salary config**, **attendance tracking**,
**payslip records**, and the **PDF download**.

---

## 1. What you asked for (restated)

- Admin/HR sets up each team member with a **base salary**.
- Admin sets a **per-absent-day deduction amount** (salary cut policy for absence).
- Admin sets **how much commission per deal** (commission rate per member).
- When a member **closes a deal**, their commission **auto-adds** to that month's pay.
- When a member is **absent**, their salary is **cut** per the policy.
- At **month-end**, the member **downloads a salary slip (PDF)** with the full breakdown.
- **Admin manages everything** (member data, salary, deduction policy, commission rate,
  attendance, finalizing payslips).

---

## 2. What already exists — reuse, don't rebuild

| Building block | Where | How it helps |
|---|---|---|
| **Commission per deal** | `Commission`: `userId`, `commissionAmount`, `commissionPercentage`, `dealAmount`, `paidStatus`, `paymentDate`, `clientId` | This **is** "commission from a sale" — each row ties a member to an earned amount and rate. |
| **Split commissions** | `CommissionSplit`: `participantUserId`, `shareAmount`, `paidOut`, `status` | Deals split across teammates → each share can feed that person's payslip. |
| **Plan/feature gating** | `lib/plans.ts` (`PLAN_FEATURES`, pricing), `lib/entitlements.ts` `hasFeature()`, `Company.featureFlags` | Gate payroll behind one new feature key — no migration. |
| **Roles & scoping** | `requireAuth`, `isTeamMember`, `isAdminRole`, per-user permissions | Members see only their data; admins manage all — already enforced everywhere. |
| **PDF / Excel** | jsPDF + jspdf-autotable in `commissions/page.tsx`; exceljs | Salary-slip PDF + payroll Excel export are known patterns. |
| **Login signal** | `UserSession` (loginAt/logoutAt) | Optional **auto-attendance hint** ("logged in that day") — a convenience, not the source of truth. |
| **Audit trail** | `recordAudit()` | Payroll = money → every change must be audited. Already available. |

---

## 3. What's missing — what you'd actually build

1. **Salary + policy config per member** — no salary/deduction/rate fields on `User` yet.
2. **Attendance tracking** — no attendance/leave model exists (all new).
3. **Payslip records** — a monthly snapshot per member.
4. **The accrual + deduction link** — pull commissions in, push absence deductions out.
5. **Generation + download** — month-end payslip create + PDF endpoint.
6. **HR admin UI** — member setup, attendance marking, review/finalize payslips.
7. **The feature/plan gate.**

---

## 4. Recommended data model (all additive — no destructive migration)

### 4a. `PayrollProfile` — per-member HR config (the "admin fields")

```
PayrollProfile {
  userId, companyId,
  baseSalary,                 // monthly base (₹)
  perAbsentDeduction,         // ₹ cut per unpaid absent day (or null = auto pro-rate)
  defaultCommissionRate,      // % per deal, pre-fills new commissions
  paidLeavesPerMonth,         // free absences before deduction kicks in (e.g. 1–2)
  designation, joiningDate,
  currency = 'INR', active
}
```

### 4b. `Attendance` — one row per member per day

```
Attendance {
  userId, companyId,
  date: "2026-06-09",          // YYYY-MM-DD
  status: Present | Absent | HalfDay | PaidLeave | UnpaidLeave | Holiday | WeekOff,
  markedBy, note, createdAt
}
// @@unique([userId, date]) — one status per day, idempotent.
```

### 4c. `CompanyPayrollPolicy` — company-wide defaults (or fields on Company)

```
{ workingDaysPerMonth | workingWeekdays,
  deductionMode: 'fixed_per_day' | 'pro_rated',   // see §6
  defaultPerAbsentDeduction, defaultCommissionRate,
  defaultPaidLeavesPerMonth, payDayOfMonth }
```

### 4d. `Payslip` + `PayslipLine` — the monthly snapshot (heart of it)

```
Payslip {
  userId, companyId, period: "2026-06",
  baseSalary,                  // snapshot at generation
  commissionTotal,
  absentDays, unpaidAbsentDays, absenceDeduction,
  additions, otherDeductions,  // bonus / advance / PF (optional)
  netPay,
  status: Draft | Finalized | Paid,
  lines: PayslipLine[],
  generatedAt, finalizedAt, finalizedBy
}
PayslipLine { sourceType: 'base'|'commission'|'absence'|'adjustment',
              commissionId?, clientName?, dealAmount?, amount(+/-), note }
```

**Why a snapshot, not live-compute:** once a member downloads their June slip it must
**never change**, even if a deal or an attendance record is edited later. Finalized
payslips are immutable records — the single most important payroll rule.

---

## 5. Admin configuration fields (what HR/Admin sets up)

This is the explicit "admin field" list you asked for. Per **team member** (in the HR setup screen):

| Field | Example | Notes |
|---|---|---|
| Member (name/email/role) | Ramesh — user | Mostly read from `User`; pick the member. |
| Designation | Sales Executive | Optional, shows on slip. |
| Joining date | 01 Apr 2026 | Drives pro-rating for new joiners. |
| **Base salary (₹/month)** | 25,000 | The fixed monthly pay. |
| **Per-absent-day deduction (₹)** | 800 | Salary cut per unpaid absent day. Or leave blank → auto pro-rate (salary ÷ working days). |
| **Paid leaves / month** | 1 | Free absences before deduction starts. |
| **Commission rate per deal (%)** | 1.5% | Default; pre-fills when a deal/commission is created. Per-deal override still allowed. |

Per **company** (one-time policy): working days/week, deduction mode (fixed vs pro-rated),
default commission rate, default paid-leave allowance, pay day.

---

## 6. The salary-slip math (clear formula)

```
grossEarnings   = baseSalary + commissionTotal + additions
perDayDeduction = perAbsentDeduction   (if set)
                  else  baseSalary ÷ workingDaysInMonth   (pro-rated mode)
unpaidAbsent    = max(0, absentDays − paidLeavesRemaining)
absenceDeduction= unpaidAbsent × perDayDeduction
netPay          = grossEarnings − absenceDeduction − otherDeductions
```

- **commissionTotal** = sum of the member's deal commissions counted for that month
  (from `Commission` / `CommissionSplit`). Half-days count as 0.5 absent.
- Worked example: base 25,000, 2 absent days (1 paid leave, so 1 unpaid), deduction 800/day,
  one deal commission 12,000 → `25,000 + 12,000 − (1 × 800) = ₹36,200`.

---

## 7. The core flows

**A. HR setup (admin):** Admin opens **Payroll → Team setup**, fills the §5 fields per
member, saves `PayrollProfile`. One-time, editable.

**B. Attendance (daily/monthly):** Admin (or a future self-check-in) marks attendance —
a monthly grid (member × day) with Present/Absent/Leave/Half-day. `UserSession` logins can
**pre-suggest** "present" to save typing, but admin confirms. Absences feed the deduction.

**C. Auto-accrual on deal done:** A member's commission becomes eligible for their payslip
via the existing **commission lifecycle** (no need to hook `Client.status` directly —
`Commission`/`CommissionSplit` already represent "a deal earned money"). Earned-vs-collected
timing is decision #1 in §8.

**D. Month-end generation:** Admin clicks **Generate payslips** for the period → one
`Payslip` per active member = base + commission lines − absence deduction. Admin reviews,
adds adjustments, **Finalizes** (locks). (Cron automation later.)

**E. Member download:** Member opens **My Salary** → finalized slips → **Download PDF**
(jsPDF). Endpoint scoped so a member fetches **only their own** payslips.

**F. Admin management:** Admin sees all payslips, edits Drafts, finalizes, marks Paid,
exports Excel, audits every change.

---

## 8. Key business decisions required before any build (money = no guessing)

| # | Decision | Options / recommendation |
|---|---|---|
| 1 | **Commission: earned or collected?** | (a) when deal **closed**, or (b) when commission **collected** (`paidStatus = Paid`). Brokerages usually pay reps after they're paid → **(b) recommended.** |
| 2 | **Absence deduction mode** | **Fixed ₹/day** (simple, admin sets it) vs **pro-rated** (`salary ÷ working days`). Recommend supporting both, default fixed. |
| 3 | **Paid leave allowance** | How many free absences/month before deduction (0, 1, 2…). |
| 4 | **Who marks attendance** | Admin-only marking (simple, v1) vs member self check-in (later). |
| 5 | **Base salary pro-rating** | Full month always vs pro-rate for mid-month joiners/leavers. |
| 6 | **Deductions/taxes** | Simple (base + commission − absence ± manual) vs PF/TDS now. **Simple first recommended.** |
| 7 | **Split deals** | Pay each `CommissionSplit.shareAmount` vs only primary `userId`. **Honor splits recommended.** |
| 8 | **Finalize trigger** | Admin "Generate + Finalize" at month-end vs automated cron on pay-day. |

---

## 9. The membership-plan / gating piece

- **(Recommended) Gated feature:** add `feature.payroll` to `FEATURE_KEYS` in
  `lib/plans.ts`, map to **Pro/Enterprise** (or sell as add-on via `Company.featureFlags`).
  Gate UI + every payroll API with `hasFeature('feature.payroll')`. Zero migration.
- **New plan tier** ("Business+ / HR") in `PLANS` with its own price — matches "another
  membership plan" literally but adds pricing/checkout/superadmin work.

Recommendation: ship as a **gated feature** first; mint a separate tier only if you want
distinct packaging/pricing.

---

## 10. Security & correctness must-haves (it's payroll)

- **Strict access:** members read **only their own** payslips; only admin/HR writes.
  Enforced server-side (mirrors existing ownership scoping).
- **Immutability:** finalized payslips are read-only snapshots; later edits to a commission
  or attendance row must **not** change a finalized slip.
- **Audit everything:** salary/policy changes, attendance edits, generation, finalize,
  mark-paid → `recordAudit`.
- **Money handling:** consistent ₹ rounding, fixed numeric convention, never trust
  client-sent totals (recompute server-side).
- **Feature/plan gate on every payroll API**, not just the UI.

---

## 11. Suggested phased rollout

| Phase | Scope |
|---|---|
| **P0** | `PayrollProfile` (base salary, per-absent deduction, commission rate, paid leaves) + HR setup UI + `feature.payroll` gate |
| **P1** | `Attendance` model + monthly attendance grid (admin-marked, login-assisted) |
| **P2** | `Payslip`/`PayslipLine` + month-end generate (base + commission − absence) + admin review/finalize |
| **P3** | Member "My Salary" page + **PDF download** of finalized slips |
| **P4** | Adjustments (bonus/advance/PF), Excel export, member self check-in, scheduled auto-generation (cron) |

**Effort:** P0–P3 is the real MVP (a member downloads a slip with base + commissions −
absences). Medium-sized — schema additions, ~6–8 endpoints, 3 pages (HR setup, attendance
grid, my-salary), and a PDF template — but **low-risk** because it leans on existing
Commission + PDF + gating infrastructure.

---

## 12. Recommendation (summary)

Ship as a gated **`feature.payroll`**, accrue commission **when collected**
(`paidStatus = Paid`), absence deduction **fixed ₹/day** (admin-set, with pro-rate
option), **1 paid leave/month** default, **admin-marked attendance** for v1, deductions
**simple**, and **snapshot** finalized payslips. Honor commission splits.

**Next step:** confirm the 8 decisions in §8 (especially #1 commission timing, #2 deduction
mode, #6 deductions scope). Those answers turn this report into a concrete implementation
plan, after which the build proceeds P0 → P4.

---

## 13. Sample salary slip (the downloadable document)

This is the layout the PDF/Excel would render. Sample numbers match the §6 example
(base ₹25,000, 1 unpaid absent day @ ₹800, ₹12,000 commission → net ₹36,200).

```
============================================================
                  SALARY SLIP — June 2026
                   Acme Realty Pvt. Ltd.
============================================================
```

**Employee details**

| Field | Value | Field | Value |
|---|---|---|---|
| Name | Ramesh Kumar | Employee ID | EMP-00042 |
| Designation | Sales Executive | Pay period | 01–30 Jun 2026 |
| Joining date | 01 Apr 2026 | Pay date | 30 Jun 2026 |

**Attendance summary**

| Working days | Present | Paid leave | Unpaid absent | Half-days |
|---|---|---|---|---|
| 26 | 24 | 1 | 1 | 0 |

**Commission — deals closed this month**

| Date | Client | Deal amount (₹) | Rate | Commission (₹) |
|---|---|---|---|---|
| 06 Jun | Sunrise Apartments | 45,00,000 | 1.5% | 8,000 |
| 21 Jun | Green Villa Plot | 22,00,000 | 1.5% | 4,000 |
| | | | **Total** | **12,000** |

**Earnings & deductions**

| Earnings | Amount (₹) | Deductions | Amount (₹) |
|---|---:|---|---:|
| Base salary | 25,000 | Absence (1 day × ₹800) | 800 |
| Commission (2 deals) | 12,000 | Advance / PF / other | 0 |
| Bonus / additions | 0 | | |
| **Gross earnings** | **37,000** | **Total deductions** | **800** |

**Net pay**

| | Amount (₹) |
|---|---:|
| Gross earnings | 37,000 |
| Less: total deductions | − 800 |
| **NET PAY** | **₹ 36,200** |

```
Generated 30 Jun 2026 · Status: Finalized · Approved by: Admin (Priya)
This is a system-generated salary slip.
============================================================
```

**Notes on the layout**
- The **Commission** block is itemized per deal (pulled from `Commission`/`CommissionSplit`),
  so the member sees exactly which deals paid them.
- The **Attendance** row drives the absence deduction line via the §6 formula.
- Everything is a **snapshot** at finalize time — later edits to a deal/attendance don't
  change this slip.
- Admin sees the same layout for every member + an Excel export of all slips for the month.
