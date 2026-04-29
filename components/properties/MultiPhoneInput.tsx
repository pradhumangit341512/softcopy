'use client';

/**
 * MultiPhoneInput — F12
 *
 * Repeating phone-number input for the owner's contact list. The first
 * row is bound to react-hook-form's `ownerPhone` (still required) and
 * the additional rows are kept in local state, sent to the server as
 * `ownerPhones`. Server merges + dedupes — see /api/properties.
 *
 * Why local state for the extras
 * ──────────────────────────────
 * react-hook-form's `useFieldArray` would mean adding `ownerPhones` to
 * the form schema and wiring per-field validation. The extras are pure
 * UI sugar — they don't need per-field error messages. Local state +
 * the parent merging the array into the submitted payload keeps the
 * integration minimal.
 *
 * Usage
 * ─────
 *   const [extras, setExtras] = useState<string[]>([]);
 *   <MultiPhoneInput
 *     primaryRegister={register('ownerPhone', { required: '…' })}
 *     primaryError={errors.ownerPhone?.message}
 *     extras={extras}
 *     onChange={setExtras}
 *     initialExtras={initialData?.ownerPhones?.slice(1)}
 *   />
 *
 *   // in submitHandler:
 *   onSubmit({ ...data, ownerPhones: [data.ownerPhone, ...extras] });
 */

import { useEffect, useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/common/Input';

interface MultiPhoneInputProps {
  /** result of register('ownerPhone', { required: '…' }) */
  primaryRegister: UseFormRegisterReturn;
  primaryError?: string;
  /** Extra phone numbers (without the primary). Caller stores in state. */
  extras: string[];
  onChange: (next: string[]) => void;
  /** Initial extras to seed when the form first loads (edit mode). */
  initialExtras?: string[];
  /** Hard cap on total numbers — prevents accidentally pasting 50. */
  maxTotal?: number;
  /** Label shown above the primary input. */
  primaryLabel?: string;
}

export function MultiPhoneInput({
  primaryRegister,
  primaryError,
  extras,
  onChange,
  initialExtras,
  maxTotal = 5,
  primaryLabel = 'Owner Phone *',
}: MultiPhoneInputProps) {
  const reactId = useId();

  // Hydrate extras from initialExtras the first time we see them — used
  // in edit mode where the parent loads the property and passes its
  // ownerPhones[1..] in. Skips primary index 0 because that's bound to
  // `register('ownerPhone')`.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    if (initialExtras && initialExtras.length > 0) {
      onChange(initialExtras);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExtras, hydrated]);

  function update(idx: number, value: string) {
    const next = [...extras];
    next[idx] = value;
    onChange(next);
  }

  function remove(idx: number) {
    const next = extras.filter((_, i) => i !== idx);
    onChange(next);
  }

  function add() {
    if (extras.length + 1 >= maxTotal) return; // primary + extras ≥ max
    onChange([...extras, '']);
  }

  const canAddMore = extras.length + 1 < maxTotal;

  return (
    <div className="space-y-2">
      <Input
        label={primaryLabel}
        placeholder="+91 XXXXX XXXXX"
        {...primaryRegister}
        error={primaryError}
      />

      {extras.map((value, idx) => (
        <div key={`${reactId}-${idx}`} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={idx === 0 ? 'Additional Phone' : ' '}
              placeholder="+91 XXXXX XXXXX"
              value={value}
              onChange={(e) => update(idx, e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            aria-label={`Remove additional phone ${idx + 1}`}
            className="mb-1 inline-flex items-center justify-center w-9 h-9 rounded-lg
              border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {canAddMore && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus size={14} /> Add Mobile Number
        </button>
      )}

    </div>
  );
}
