'use client';

/**
 * AddPropertyWizard — F9
 *
 * 3-step guided flow for capturing a new inventory item. Reuses the same
 * `PropertyFormValues` shape as the single-page form so the parent's
 * onSubmit handler doesn't need to know which form mode shipped the data.
 *
 * Steps
 * ─────
 *   1. Seller Details   — owner identity + F11 deal-flow fields
 *   2. Property Details — address + F10 project identity + size / type / status
 *   3. Source/Assignment — description + transfer-style notes
 *
 * F10 (project fields) and F11 (deal fields) collapse out of step 1/2 if
 * those sub-features are off — same gating the single-page form uses.
 *
 * Validation
 * ──────────
 *   We validate per-step on Next click (only the fields visible on that
 *   step) so users don't see "fix something on step 3" before they've
 *   even reached it. Final submit re-validates everything.
 */

import { useState } from 'react';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Check, User, Building2, Sparkles } from 'lucide-react';
import { useFeature } from '@/hooks/useFeature';
import {
  PropertyType,
  PropertyStatus,
  BHK_TYPE_OPTIONS,
  PROPERTY_TYPES_WITH_BHK,
} from '@/lib/types';
import {
  PROPERTY_STATUSES,
  PAYMENT_STATUSES,
  CASE_TYPES,
  LOAN_STATUSES,
} from '@/lib/constants';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { MultiPhoneInput } from './MultiPhoneInput';
import type { PropertyFormValues } from './PropertyForm';

interface AddPropertyWizardProps {
  onSubmit: (data: PropertyFormValues) => Promise<boolean>;
  initialData?: Partial<PropertyFormValues>;
  isLoading?: boolean;
}

const STEPS = [
  { id: 1, label: 'Seller',   icon: User },
  { id: 2, label: 'Property', icon: Building2 },
  { id: 3, label: 'Source',   icon: Sparkles },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// Field-name groups per step — used for per-step validation triggers.
const STEP_FIELDS: Record<StepId, ReadonlyArray<keyof PropertyFormValues>> = {
  1: ['ownerName', 'ownerPhone', 'ownerEmail', 'demand', 'paymentStatus', 'caseType', 'loanStatus'],
  2: [
    'propertyName', 'address', 'propertyType', 'bhkType', 'area', 'vacateDate',
    'askingRent', 'sellingPrice', 'status',
    'projectName', 'sectorNo', 'unitNo', 'towerNo', 'typology',
  ],
  3: ['description'],
};

const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';
const selectStyle =
  'w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
const errorStyle = 'text-red-500 text-xs mt-1';

export function AddPropertyWizard({ onSubmit, initialData, isLoading = false }: AddPropertyWizardProps) {
  const [step, setStep] = useState<StepId>(1);

  const showProjectFields = useFeature('feature.inventory_project_fields');
  const showDealFields = useFeature('feature.inventory_deal_fields');
  const useExtendedPropertyStatuses = useFeature('feature.extended_property_statuses');
  const showMultiPhone = useFeature('feature.multi_phone');

  // F12 — extras stored alongside the wizard's react-hook-form state.
  // Merged into the submitted payload below; server dedupes against
  // the primary phone.
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const initialExtras = (initialData?.ownerPhones ?? []).slice(1);

  const statusValues: ReadonlyArray<string> = useExtendedPropertyStatuses
    ? PROPERTY_STATUSES
    : Object.values(PropertyStatus);
  const initialStatus = initialData?.status ?? 'Available';
  const statusOptions = statusValues.includes(initialStatus)
    ? statusValues
    : [initialStatus, ...statusValues];

  const {
    register,
    handleSubmit,
    trigger,
    control,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    defaultValues: {
      propertyName: initialData?.propertyName || '',
      address: initialData?.address || '',
      propertyType: initialData?.propertyType || '',
      bhkType: initialData?.bhkType || '',
      vacateDate: initialData?.vacateDate ? new Date(initialData.vacateDate).toISOString().split('T')[0] : '',
      askingRent: initialData?.askingRent?.toString() || '',
      sellingPrice: initialData?.sellingPrice?.toString() || '',
      area: initialData?.area || '',
      description: initialData?.description || '',
      status: initialStatus,
      projectName: initialData?.projectName || '',
      sectorNo:    initialData?.sectorNo || '',
      unitNo:      initialData?.unitNo || '',
      towerNo:     initialData?.towerNo || '',
      typology:    initialData?.typology || '',
      demand:        initialData?.demand?.toString() || '',
      paymentStatus: initialData?.paymentStatus || '',
      caseType:      initialData?.caseType || '',
      loanStatus:    initialData?.loanStatus || '',
      ownerName: initialData?.ownerName || '',
      ownerPhone: initialData?.ownerPhone || '',
      ownerEmail: initialData?.ownerEmail || '',
    },
  });

  // useWatch is the React-Compiler-friendly equivalent of `watch()` —
  // matches the pattern PropertyForm.tsx already uses.
  const watchedPropertyType = useWatch({ control, name: 'propertyType' }) ?? '';
  const showBHK = PROPERTY_TYPES_WITH_BHK.includes(watchedPropertyType);

  async function goNext() {
    const ok = await trigger(STEP_FIELDS[step] as (keyof PropertyFormValues)[]);
    if (!ok) return;
    setStep((s) => (Math.min(3, s + 1) as StepId));
  }

  function goBack() {
    setStep((s) => (Math.max(1, s - 1) as StepId));
  }

  const submitHandler: SubmitHandler<PropertyFormValues> = async (data) => {
    if (!PROPERTY_TYPES_WITH_BHK.includes(data.propertyType)) {
      data.bhkType = undefined;
      data.vacateDate = undefined;
    }
    // F12 — merge primary phone + extras into a deduped list before posting.
    if (showMultiPhone) {
      const merged = Array.from(
        new Set(
          [data.ownerPhone, ...extraPhones]
            .map((p) => (p ?? '').trim())
            .filter(Boolean)
        )
      );
      data.ownerPhones = merged;
    }
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} noValidate className="w-full max-w-3xl mx-auto px-4 sm:px-6 space-y-5">
      <Stepper currentStep={step} />

      {step === 1 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
            Seller Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Owner Name *"
              placeholder="Full name"
              {...register('ownerName', { required: 'Owner name is required' })}
              error={errors.ownerName?.message}
            />
            {showMultiPhone ? (
              <MultiPhoneInput
                primaryRegister={register('ownerPhone', { required: 'Owner phone is required' })}
                primaryError={errors.ownerPhone?.message}
                extras={extraPhones}
                onChange={setExtraPhones}
                initialExtras={initialExtras}
              />
            ) : (
              <Input
                label="Owner Phone *"
                placeholder="+91 XXXXX XXXXX"
                {...register('ownerPhone', { required: 'Owner phone is required' })}
                error={errors.ownerPhone?.message}
              />
            )}
          </div>
          <Input
            label="Owner Email"
            placeholder="owner@example.com"
            {...register('ownerEmail')}
            error={errors.ownerEmail?.message}
          />

          {showDealFields && (
            <>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">
                Deal Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Owner Demand (₹)"
                  type="number"
                  placeholder="e.g. 24000000"
                  {...register('demand')}
                />
                <div>
                  <label className={labelStyle}>Payment Status</label>
                  <select {...register('paymentStatus')} className={selectStyle}>
                    <option value="">—</option>
                    {PAYMENT_STATUSES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Case Type</label>
                  <select {...register('caseType')} className={selectStyle}>
                    <option value="">—</option>
                    {CASE_TYPES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Loan Status</label>
                  <select {...register('loanStatus')} className={selectStyle}>
                    <option value="">—</option>
                    {LOAN_STATUSES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
            Property Details
          </h3>
          <Input
            label="Listing / Inventory Name *"
            placeholder="e.g. Green Valley Apartment"
            {...register('propertyName', { required: 'Inventory name is required' })}
            error={errors.propertyName?.message}
          />
          <Input
            label="Address *"
            placeholder="Full property address"
            {...register('address', { required: 'Address is required' })}
            error={errors.address?.message}
          />

          {showProjectFields && (
            <>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">
                Project Identity
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Project Name" placeholder="e.g. DLF Cyber City" {...register('projectName')} />
                <Input label="Sector"       placeholder="e.g. Sector 24"      {...register('sectorNo')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="Tower"     placeholder="e.g. Tower B"  {...register('towerNo')} />
                <Input label="Unit No"   placeholder="e.g. B-1204"   {...register('unitNo')} />
                <Input label="Typology"  placeholder="e.g. 3BHK"     {...register('typology')} />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelStyle}>Property Type *</label>
              <select
                {...register('propertyType', { required: 'Property type is required' })}
                className={selectStyle}
              >
                <option value="">Select type</option>
                {Object.values(PropertyType).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {errors.propertyType && (
                <p className={errorStyle}>{errors.propertyType.message}</p>
              )}
            </div>
            {showBHK && (
              <div>
                <label className={labelStyle}>BHK</label>
                <select {...register('bhkType')} className={selectStyle}>
                  <option value="">Select configuration</option>
                  {BHK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Area" placeholder="e.g. 1200 sq ft" {...register('area')} />
            <Input
              label="Asking Rent (₹)"
              type="number"
              placeholder="e.g. 25000"
              {...register('askingRent')}
            />
            <Input
              label="Selling Price (₹)"
              type="number"
              placeholder="e.g. 5000000"
              {...register('sellingPrice')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Vacate Date"
              type="date"
              {...register('vacateDate')}
            />
            <div>
              <label className={labelStyle}>Status</label>
              <select {...register('status')} className={selectStyle}>
                {statusOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
            Source &amp; Notes
          </h3>
          <div>
            <label className={labelStyle}>Description / Remarks</label>
            <textarea
              {...register('description')}
              placeholder="Anything else worth recording — visibility, neighbourhood, owner preferences…"
              rows={5}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            Source &amp; assignment fields will land here as Phase 3 features ship
            (Find Opportunity matcher, captured-by, transfer-to). For now the
            row is captured by the current user automatically.
          </p>
        </section>
      )}

      {/* Footer — back/next/submit */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-gray-100">
        <div>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              icon={<ArrowLeft size={16} />}
            >
              Back
            </Button>
          )}
        </div>
        <div className="flex justify-end">
          {step < 3 ? (
            <Button type="button" onClick={goNext}>
              Next <ArrowRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving…' : (
                <>
                  <Check size={16} className="mr-1" /> Save Inventory
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

/** Header strip showing step progression with active + completed states. */
function Stepper({ currentStep }: { currentStep: StepId }) {
  return (
    <ol className="flex items-center justify-between gap-2 sm:gap-4 px-1 sm:px-2">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const isActive = currentStep === s.id;
        const isDone = currentStep > s.id;
        return (
          <li key={s.id} className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={
                isActive
                  ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm'
                  : isDone
                  ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0'
                  : 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0'
              }
              aria-current={isActive ? 'step' : undefined}
            >
              {isDone ? <Check size={16} /> : <Icon size={16} />}
            </div>
            <div className="min-w-0">
              <p className={
                isActive ? 'text-xs sm:text-sm font-semibold text-blue-700 truncate'
                : isDone   ? 'text-xs sm:text-sm font-medium text-emerald-700 truncate'
                : 'text-xs sm:text-sm font-medium text-gray-400 truncate'
              }>
                Step {s.id}
              </p>
              <p className={
                isActive ? 'text-xs text-gray-700 truncate hidden sm:block'
                : 'text-xs text-gray-400 truncate hidden sm:block'
              }>
                {s.label}
              </p>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                aria-hidden
                className={
                  isDone
                    ? 'flex-1 h-px bg-emerald-300 ml-1 sm:ml-2'
                    : 'flex-1 h-px bg-gray-200 ml-1 sm:ml-2'
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
