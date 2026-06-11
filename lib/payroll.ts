/**
 * Payslip computation engine (Enterprise HR plan, P3).
 *
 * Pure functions — no DB. The generate route fetches the inputs (profile,
 * attendance statuses, the member's accrued commission lines) and calls
 * computePayslip() to produce the numbers + line items that get snapshotted
 * onto a Payslip row.
 *
 * Formula:
 *   gross        = base + allowances + commission + additions
 *   perDayCut    = perAbsentDeduction ?? (base ÷ workingDays)
 *   chargeable   = max(0, rawAbsentUnits − paidLeaveAllowance)
 *   absenceCut   = chargeable × perDayCut
 *   net          = gross − absenceCut − otherDeductions
 */

import { absentUnitsFor } from './attendance';

export type PayslipLineType = 'base' | 'allowance' | 'commission' | 'absence' | 'adjustment';

export interface PayslipLine {
  sourceType: PayslipLineType;
  label: string;
  amount: number; // signed: earnings +, deductions −
  clientName?: string | null;
  date?: string | null;
}

export interface CommissionLine {
  label: string;
  amount: number;
  clientName?: string | null;
  date?: string | null;
}

export interface ComputeInput {
  period: string; // YYYY-MM
  baseSalary: number;
  travelAllowance: number;
  otherAllowance: number;
  perAbsentDeduction: number | null;
  paidLeavesPerMonth: number;
  attendanceStatuses: string[];
  commissionLines: CommissionLine[];
  additions?: number;
  otherDeductions?: number;
}

export interface ComputedPayslip {
  baseSalary: number;
  allowancesTotal: number;
  commissionTotal: number;
  additions: number;
  grossEarnings: number;
  presentDays: number;
  absentUnits: number;       // chargeable units after paid-leave allowance
  rawAbsentUnits: number;    // before allowance
  paidLeaves: number;
  perDayDeduction: number;
  absenceDeduction: number;
  otherDeductions: number;
  netPay: number;
  lines: PayslipLine[];
}

/** Round to the nearest rupee (consistent money convention). */
export const inr = (n: number): number => Math.round(n);

/** Working days in a month = all days minus Sundays (no holiday calendar v1). */
export function workingDaysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(y, m - 1, d).getDay() !== 0) count++;
  }
  return count || days;
}

export function computePayslip(input: ComputeInput): ComputedPayslip {
  const baseSalary = inr(input.baseSalary);
  const travel = inr(input.travelAllowance);
  const other = inr(input.otherAllowance);
  const allowancesTotal = travel + other;
  const additions = inr(input.additions ?? 0);
  const otherDeductions = inr(input.otherDeductions ?? 0);

  const commissionLines = input.commissionLines.map((l) => ({ ...l, amount: inr(l.amount) }));
  const commissionTotal = commissionLines.reduce((s, l) => s + l.amount, 0);

  // Attendance tallies.
  let presentDays = 0;
  let paidLeaves = 0;
  let rawAbsentUnits = 0;
  for (const s of input.attendanceStatuses) {
    if (s === 'present') presentDays += 1;
    else if (s === 'half_day') presentDays += 0.5;
    else if (s === 'paid_leave') paidLeaves += 1;
    rawAbsentUnits += absentUnitsFor(s);
  }

  const chargeable = Math.max(0, rawAbsentUnits - Math.max(0, input.paidLeavesPerMonth));
  const perDayDeduction =
    input.perAbsentDeduction != null
      ? input.perAbsentDeduction
      : baseSalary / workingDaysInMonth(input.period);
  const absenceDeduction = inr(chargeable * perDayDeduction);

  const grossEarnings = baseSalary + allowancesTotal + commissionTotal + additions;
  const netPay = grossEarnings - absenceDeduction - otherDeductions;

  const lines: PayslipLine[] = [{ sourceType: 'base', label: 'Base salary', amount: baseSalary }];
  if (travel > 0) lines.push({ sourceType: 'allowance', label: 'Travel allowance', amount: travel });
  if (other > 0) lines.push({ sourceType: 'allowance', label: 'Other allowance', amount: other });
  for (const l of commissionLines) {
    lines.push({ sourceType: 'commission', label: l.label, amount: l.amount, clientName: l.clientName ?? null, date: l.date ?? null });
  }
  if (additions > 0) lines.push({ sourceType: 'adjustment', label: 'Additions / bonus', amount: additions });
  if (absenceDeduction > 0) {
    lines.push({ sourceType: 'absence', label: `Unpaid absence (${chargeable} day${chargeable === 1 ? '' : 's'})`, amount: -absenceDeduction });
  }
  if (otherDeductions > 0) lines.push({ sourceType: 'adjustment', label: 'Other deductions', amount: -otherDeductions });

  return {
    baseSalary, allowancesTotal, commissionTotal, additions, grossEarnings,
    presentDays, absentUnits: chargeable, rawAbsentUnits, paidLeaves,
    perDayDeduction: inr(perDayDeduction), absenceDeduction, otherDeductions,
    netPay, lines,
  };
}

// ─── Amount in words (Indian numbering: lakh / crore) ───
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : ''}${r ? twoDigits(r) : ''}`;
}

/** "₹36,200" → "Thirty Six Thousand Two Hundred Rupees Only" (Indian system). */
export function amountInWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return 'Zero Rupees Only';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return `${parts.join(' ')} Rupees Only`.replace(/\s+/g, ' ').trim();
}
