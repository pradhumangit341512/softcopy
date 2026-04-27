'use client';

import { ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { ClientSearchInput, type SelectedClient } from '@/components/common/ClientSearchInput';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export interface DealSectionState {
  selectedClient: SelectedClient | null;
  builderName: string;
  salesPersonName: string;
  dealAmount: string;
  commissionPercentage: string;
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
  const computedCommission =
    state.dealAmount && state.commissionPercentage
      ? (Number(state.dealAmount) * Number(state.commissionPercentage)) / 100
      : 0;

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
                Type to search by name, phone, or email. New client? Add them first under{' '}
                <span className="font-medium">Clients</span>.
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

          {/* DEAL AMOUNT + COMMISSION % */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Commission %
              </label>
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
            </div>
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
