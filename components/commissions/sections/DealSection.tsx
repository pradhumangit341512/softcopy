'use client';

import { ChevronDown, ChevronUp, Building2, Percent, IndianRupee } from 'lucide-react';
import { ClientSearchInput, type SelectedClient } from '@/components/common/ClientSearchInput';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export type CommissionMode = 'percent' | 'flat';

export interface DealSectionState {
  selectedClient: SelectedClient | null;
  builderName: string;
  salesPersonName: string;
  dealAmount: string;
  /**
   * 'percent' — broker enters a % of the deal; commission = deal × pct / 100
   * 'flat'    — broker enters a fixed ₹ amount; we back-compute pct so the
   *             API contract (which stores both fields) stays unchanged.
   */
  commissionMode: CommissionMode;
  commissionPercentage: string;
  /** Used only when commissionMode === 'flat'. Free-form rupee amount. */
  commissionFlatAmount: string;
  paymentReference: string;
}

interface DealSectionProps {
  mode: 'add' | 'manage';
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;

  state: DealSectionState;
  onClientChange: (c: SelectedClient | null) => void;
  onFieldChange: <K extends keyof Omit<DealSectionState, 'selectedClient'>>(
    key: K,
    value: DealSectionState[K],
  ) => void;

  /**
   * Manage mode only: set true while a save is in flight.
   * Add mode hides its own Save button — submit is owned by the modal footer.
   */
  saving?: boolean;
  /** Manage mode only: enable the Save button only when there are changes. */
  dirty?: boolean;
  onSave?: () => void;
}

/**
 * Section [1] of the merged Manage-Deal modal — captures the shape of the
 * deal itself (parties + amounts) and the auto-derived commission ₹.
 *
 * In `add` mode this is purely controlled — submit is owned by the modal.
 * In `manage` mode the section gets its own "Save deal changes" button so
 * the broker can edit deal metadata without touching payments.
 */
export function DealSection({
  mode,
  isAdmin,
  collapsed,
  onToggle,
  state,
  onClientChange,
  onFieldChange,
  saving,
  dirty,
  onSave,
}: DealSectionProps) {
  const dealNum = Number(state.dealAmount) || 0;
  const pctNum = Number(state.commissionPercentage) || 0;
  const flatNum = Number(state.commissionFlatAmount) || 0;
  const computedCommission =
    state.commissionMode === 'flat'
      ? flatNum
      : dealNum && pctNum
        ? (dealNum * pctNum) / 100
        : 0;
  /** Implied % shown next to the flat amount so brokers see the equivalent rate. */
  const impliedPercent =
    state.commissionMode === 'flat' && dealNum > 0 && flatNum > 0
      ? (flatNum / dealNum) * 100
      : 0;
  const flatExceedsDeal = state.commissionMode === 'flat' && flatNum > dealNum && dealNum > 0;

  // Team members can't edit deal metadata in manage mode (admin-only PUT).
  const fieldsLocked = mode === 'manage' && !isAdmin;

  return (
    <section className="border border-gray-100 rounded-2xl bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4
          text-left hover:bg-gray-50/60 rounded-2xl transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 size={15} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Deal</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Client, builder, deal amount, commission %
            </p>
          </div>
        </div>
        {collapsed ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronUp size={16} className="text-gray-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4">
          {/* CLIENT */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Client {mode === 'add' && <span className="text-red-500">*</span>}
            </label>
            <ClientSearchInput
              selected={state.selectedClient}
              onSelect={onClientChange}
              autoFocus={mode === 'add' && !state.selectedClient}
              // In manage mode the client cannot be re-assigned — that would
              // orphan the existing payment ledger / splits.
              lockOnceSelected={mode === 'manage'}
              disabled={fieldsLocked}
            />
            {mode === 'add' && !state.selectedClient && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                Type to search by name, phone, or email. New lead? Add them first under{' '}
                <span className="font-medium">Leads</span>.
              </p>
            )}
          </div>

          {/* BUILDER */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Builder / Developer
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={state.builderName}
              onChange={(e) => onFieldChange('builderName', e.target.value)}
              placeholder="e.g. Lodha Group, DLF, ATS Greens…"
              disabled={fieldsLocked}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                text-gray-800 placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* SALES PERSON */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Sales Person
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={state.salesPersonName}
              onChange={(e) => onFieldChange('salesPersonName', e.target.value)}
              placeholder="Enter sales person name…"
              disabled={fieldsLocked}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                text-gray-800 placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* DEAL AMOUNT */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Deal Amount (₹) {mode === 'add' && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={state.dealAmount}
                onChange={(e) => onFieldChange('dealAmount', e.target.value)}
                placeholder="0"
                min="0"
                disabled={fieldsLocked}
                className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                  text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* COMMISSION MODE TOGGLE — Percent vs Flat ₹ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-xs font-semibold text-gray-600">
                Commission
              </span>
              <div
                role="tablist"
                aria-label="Commission mode"
                className="inline-flex bg-gray-100 rounded-lg p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={state.commissionMode !== 'flat'}
                  disabled={fieldsLocked}
                  onClick={() => onFieldChange('commissionMode', 'percent')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1
                    transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      state.commissionMode !== 'flat'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Percent size={11} /> Percent
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={state.commissionMode === 'flat'}
                  disabled={fieldsLocked}
                  onClick={() => onFieldChange('commissionMode', 'flat')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1
                    transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      state.commissionMode === 'flat'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <IndianRupee size={11} /> Flat ₹
                </button>
              </div>
            </div>

            {state.commissionMode === 'flat' ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={state.commissionFlatAmount}
                  onChange={(e) => onFieldChange('commissionFlatAmount', e.target.value)}
                  placeholder="e.g. 50000"
                  min="0"
                  step="1"
                  disabled={fieldsLocked}
                  className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                    text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            ) : (
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={state.commissionPercentage}
                  onChange={(e) => onFieldChange('commissionPercentage', e.target.value)}
                  placeholder="5"
                  min="0"
                  max="100"
                  step="0.5"
                  disabled={fieldsLocked}
                  className="w-full px-3 pr-7 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %
                </span>
              </div>
            )}

            {flatExceedsDeal && (
              <p className="text-[11px] text-red-500 font-medium mt-1.5">
                Flat amount can't exceed the deal amount.
              </p>
            )}
            {state.commissionMode === 'flat' && impliedPercent > 0 && !flatExceedsDeal && (
              <p className="text-[11px] text-gray-500 mt-1.5">
                ≈ {impliedPercent.toFixed(2)}% of deal amount
              </p>
            )}
            {state.commissionMode === 'percent' && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                Switch to <span className="font-semibold">Flat ₹</span> if your deal is on a
                fixed-fee basis.
              </p>
            )}
          </div>

          {/* AUTO COMMISSION DISPLAY */}
          {computedCommission > 0 && (
            <div
              className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3
                flex items-center justify-between"
            >
              <span className="text-xs font-medium text-emerald-700">Commission Amount</span>
              <span className="text-base font-bold text-emerald-700">
                {fmt(computedCommission)}
              </span>
            </div>
          )}

          {/* PAYMENT REFERENCE */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Payment Reference
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={state.paymentReference}
              onChange={(e) => onFieldChange('paymentReference', e.target.value)}
              placeholder="Cheque no., UPI Ref, Transaction ID…"
              disabled={fieldsLocked}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                text-gray-800 placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* MANAGE-MODE SAVE BUTTON */}
          {mode === 'manage' && !fieldsLocked && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600
                  hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50
                  disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save deal changes'}
              </button>
            </div>
          )}

          {fieldsLocked && (
            <p className="text-[11px] text-gray-400 italic">
              Deal metadata is admin-only. Ask an admin to edit.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
