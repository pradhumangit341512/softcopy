/**
 * Attendance status catalogue — single source of truth for the day-status list
 * and how each status affects payroll (absent units charged).
 *
 * Used by:
 *   - GET/POST /api/payroll/attendance   (marking)
 *   - the admin attendance grid
 *   - the P3 payslip engine (absentUnits drives the absence deduction)
 *
 * "absentUnits" = fraction of a day that counts as chargeable absence BEFORE
 * the paid-leave allowance is applied. Present/Holiday/WeekOff/PaidLeave = 0;
 * HalfDay = 0.5; Absent/UnpaidLeave = 1.
 */

export interface AttendanceStatusDef {
  value: string;
  label: string;
  /** Short badge text shown in the grid. */
  short: string;
  /** Chargeable absence units (0, 0.5, or 1) before paid-leave allowance. */
  absentUnits: number;
  /** Tailwind text + bg classes for the grid cell. */
  cell: string;
}

export const ATTENDANCE_STATUSES: readonly AttendanceStatusDef[] = [
  { value: 'present',      label: 'Present',      short: 'P',  absentUnits: 0,   cell: 'bg-green-100 text-green-700' },
  { value: 'absent',       label: 'Absent',       short: 'A',  absentUnits: 1,   cell: 'bg-red-100 text-red-700' },
  { value: 'half_day',     label: 'Half day',     short: 'H',  absentUnits: 0.5, cell: 'bg-amber-100 text-amber-700' },
  { value: 'paid_leave',   label: 'Paid leave',   short: 'PL', absentUnits: 0,   cell: 'bg-blue-100 text-blue-700' },
  { value: 'unpaid_leave', label: 'Unpaid leave', short: 'UL', absentUnits: 1,   cell: 'bg-rose-100 text-rose-700' },
  { value: 'holiday',      label: 'Holiday',      short: 'HO', absentUnits: 0,   cell: 'bg-gray-100 text-gray-500' },
  { value: 'week_off',     label: 'Week off',     short: 'WO', absentUnits: 0,   cell: 'bg-gray-100 text-gray-400' },
] as const;

export const ATTENDANCE_VALUES: readonly string[] = ATTENDANCE_STATUSES.map((s) => s.value);

/** Statuses offered in the grid's quick click-cycle (the everyday ones). */
export const ATTENDANCE_CYCLE: readonly string[] = ['present', 'absent', 'half_day', 'paid_leave'];

export function getAttendanceStatus(value: string | null | undefined): AttendanceStatusDef | undefined {
  if (!value) return undefined;
  return ATTENDANCE_STATUSES.find((s) => s.value === value);
}

/** Chargeable absence units for a status ('' / unknown → 0). */
export function absentUnitsFor(value: string | null | undefined): number {
  return getAttendanceStatus(value)?.absentUnits ?? 0;
}
