'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';

/** Payroll profile shape returned by the API (subset the form needs). */
export interface PayrollProfile {
  baseSalary: number;
  travelAllowance: number;
  otherAllowance: number;
  perAbsentDeduction: number | null;
  paidLeavesPerMonth: number;
  defaultCommissionRate: number;
  attendanceMode: string;
  designation: string | null;
  joiningDate: string | Date | null;
  pan: string | null;
  active: boolean;
}

export interface PayrollMember {
  id: string;
  name: string;
  email: string;
  profile: PayrollProfile | null;
}

interface Props {
  isOpen: boolean;
  member: PayrollMember | null;
  onClose: () => void;
  onSaved: () => void;
}

const numberOr = (v: number | null | undefined, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

/** Admin edits one team member's payroll config. Posts to PUT /api/payroll/profiles/[userId]. */
export function PayrollProfileModal({ isOpen, member, onClose, onSaved }: Props) {
  const [baseSalary, setBaseSalary] = useState(0);
  const [travelAllowance, setTravelAllowance] = useState(0);
  const [otherAllowance, setOtherAllowance] = useState(0);
  const [autoProRate, setAutoProRate] = useState(true);
  const [perAbsentDeduction, setPerAbsentDeduction] = useState(0);
  const [paidLeavesPerMonth, setPaidLeavesPerMonth] = useState(1);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(0);
  const [attendanceMode, setAttendanceMode] = useState('office');
  const [designation, setDesignation] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [pan, setPan] = useState('');
  const [active, setActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever a different member opens.
  useEffect(() => {
    if (!isOpen || !member) return;
    const p = member.profile;
    setBaseSalary(numberOr(p?.baseSalary));
    setTravelAllowance(numberOr(p?.travelAllowance));
    setOtherAllowance(numberOr(p?.otherAllowance));
    setAutoProRate(p ? p.perAbsentDeduction == null : true);
    setPerAbsentDeduction(numberOr(p?.perAbsentDeduction));
    setPaidLeavesPerMonth(numberOr(p?.paidLeavesPerMonth, 1));
    setDefaultCommissionRate(numberOr(p?.defaultCommissionRate));
    setAttendanceMode(p?.attendanceMode ?? 'office');
    setDesignation(p?.designation ?? '');
    setJoiningDate(toDateInput(p?.joiningDate ?? null));
    setPan(p?.pan ?? '');
    setActive(p ? p.active : true);
    setError(null);
  }, [isOpen, member]);

  async function submit() {
    if (!member) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/profiles/${member.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseSalary,
          travelAllowance,
          otherAllowance,
          perAbsentDeduction: autoProRate ? null : perAbsentDeduction,
          paidLeavesPerMonth,
          defaultCommissionRate,
          attendanceMode,
          designation: designation.trim() || null,
          joiningDate: joiningDate || null,
          pan: pan.trim() || null,
          active,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to save');
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const money =
    'mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal
      isOpen={isOpen}
      title={member ? `Payroll — ${member.name}` : 'Payroll'}
      onClose={onClose}
      onSubmit={submitting ? undefined : submit}
      submitText={submitting ? 'Saving...' : 'Save payroll'}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Wallet size={16} className="text-blue-500" />
          {member?.email}
        </div>

        {error && <Alert type="error" message={error} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Base salary (₹/month) <span className="text-red-500">*</span></span>
            <input type="number" min={0} value={baseSalary} onChange={(e) => setBaseSalary(Math.max(0, Number(e.target.value) || 0))} className={money} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Commission rate per deal (%)</span>
            <input type="number" min={0} max={100} step="0.1" value={defaultCommissionRate} onChange={(e) => setDefaultCommissionRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={money} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Travel allowance (₹)</span>
            <input type="number" min={0} value={travelAllowance} onChange={(e) => setTravelAllowance(Math.max(0, Number(e.target.value) || 0))} className={money} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Other allowance (₹)</span>
            <input type="number" min={0} value={otherAllowance} onChange={(e) => setOtherAllowance(Math.max(0, Number(e.target.value) || 0))} className={money} />
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Absence policy</p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={autoProRate} onChange={(e) => setAutoProRate(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            Auto pro-rate from base salary (base ÷ working days per absent day)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Per-absent-day cut (₹)</span>
              <input type="number" min={0} value={perAbsentDeduction} disabled={autoProRate} onChange={(e) => setPerAbsentDeduction(Math.max(0, Number(e.target.value) || 0))} className={`${money} disabled:bg-gray-50 disabled:text-gray-400`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Paid leaves / month</span>
              <input type="number" min={0} max={31} value={paidLeavesPerMonth} onChange={(e) => setPaidLeavesPerMonth(Math.max(0, Math.min(31, Number(e.target.value) || 0)))} className={money} />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Attendance mode</span>
          <select value={attendanceMode} onChange={(e) => setAttendanceMode(e.target.value)} className={`${money} bg-white`}>
            <option value="office">Office — must check in within a geofence</option>
            <option value="field">Field — check in from anywhere (logged)</option>
            <option value="manual">Manual — admin marks only (no self check-in)</option>
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Designation</span>
            <input type="text" maxLength={100} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Sales Executive" className={money} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Joining date</span>
            <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className={money} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">PAN</span>
            <input type="text" maxLength={20} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCPK1234F" className={money} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          On payroll (include in salary-slip generation)
        </label>
      </div>
    </Modal>
  );
}
