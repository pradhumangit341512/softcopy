'use client';

import { useState } from 'react';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { PropertyType, PropertyStatus, BHK_TYPE_OPTIONS, PROPERTY_TYPES_WITH_BHK } from '@/lib/types';
import {
  PROPERTY_STATUSES,
  PAYMENT_STATUSES,
  CASE_TYPES,
  LOAN_STATUSES,
} from '@/lib/constants';
import { useFeature } from '@/hooks/useFeature';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { MultiPhoneInput } from './MultiPhoneInput';

export interface PropertyFormValues {
  propertyName: string;
  address: string;
  propertyType: string;
  bhkType?: string;
  vacateDate?: string;
  askingRent?: string;
  sellingPrice?: string;
  area?: string;
  description?: string;
  status: string;
  // F10 — project identity (free-text strings to keep the form lightweight)
  projectName?: string;
  sectorNo?: string;
  unitNo?: string;
  towerNo?: string;
  typology?: string;
  // F11 — deal flow
  demand?: string;
  paymentStatus?: string;
  caseType?: string;
  loanStatus?: string;
  ownerName: string;
  ownerPhone: string;
  /** F12 — extra phone numbers beyond the primary. Server merges with
   * ownerPhone and dedupes; `ownerPhones[0]` always equals `ownerPhone`. */
  ownerPhones?: string[];
  ownerEmail?: string;
}

interface PropertyFormProps {
  onSubmit: (data: PropertyFormValues) => Promise<boolean>;
  initialData?: Partial<PropertyFormValues>;
  isLoading?: boolean;
}

/** Property creation/edit form with validation and conditional BHK selector */
export function PropertyForm({
  onSubmit,
  initialData,
  isLoading = false,
}: PropertyFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
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
      status: initialData?.status || 'Available',
      // F10 defaults
      projectName: initialData?.projectName || '',
      sectorNo:    initialData?.sectorNo || '',
      unitNo:      initialData?.unitNo || '',
      towerNo:     initialData?.towerNo || '',
      typology:    initialData?.typology || '',
      // F11 defaults
      demand:        initialData?.demand?.toString() || '',
      paymentStatus: initialData?.paymentStatus || '',
      caseType:      initialData?.caseType || '',
      loanStatus:    initialData?.loanStatus || '',
      ownerName: initialData?.ownerName || '',
      ownerPhone: initialData?.ownerPhone || '',
      ownerEmail: initialData?.ownerEmail || '',
    },
  });

  // F10 / F11 feature gates — when off, the form drops the matching
  // sections so an existing-plan customer's UI is unchanged.
  const showProjectFields = useFeature('feature.inventory_project_fields');
  const showDealFields = useFeature('feature.inventory_deal_fields');
  const showMultiPhone = useFeature('feature.multi_phone');

  // F12 — Local state for owner phones beyond the primary. The primary
  // (required) phone stays bound to react-hook-form via register('ownerPhone').
  // Extras are merged into the submitted payload below so the server gets
  // the full list as `ownerPhones`.
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  // Initial extras from existing data — slice(1) drops the primary which
  // is already wired to the react-hook-form input.
  const initialExtras = (initialData?.ownerPhones ?? []).slice(1);

  // Watch propertyType to conditionally show BHK selector
  const selectedPropertyType = useWatch({ control, name: 'propertyType' });
  const showBHK = PROPERTY_TYPES_WITH_BHK.includes(selectedPropertyType);

  // F7 — extended property-status taxonomy. When the company doesn't have
  // the feature, fall back to the legacy 4-value PropertyStatus enum so
  // existing behaviour is preserved.
  const useExtendedPropertyStatuses = useFeature('feature.extended_property_statuses');
  const statusValues: ReadonlyArray<string> = useExtendedPropertyStatuses
    ? PROPERTY_STATUSES
    : Object.values(PropertyStatus);
  // Always preserve the current value as a selectable option even if it's
  // not in the active list — protects legacy rows from silent coercion.
  const initialStatus = initialData?.status ?? 'Available';
  const statusOptions = statusValues.includes(initialStatus)
    ? statusValues
    : [initialStatus, ...statusValues];

  const submitHandler: SubmitHandler<PropertyFormValues> = async (data) => {
    // Clear bhkType and vacateDate if property type doesn't support it
    if (!PROPERTY_TYPES_WITH_BHK.includes(data.propertyType)) {
      data.bhkType = undefined;
      data.vacateDate = undefined;
    }
    // F12 — merge primary phone with the extras into a single deduped list
    // before posting. Server also dedupes; doing it here keeps the network
    // payload minimal and the UI's expectations honest.
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

  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';
  const selectStyle =
    'w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
  const errorStyle = 'text-red-500 text-xs mt-1';

  return (
    <form
      onSubmit={handleSubmit(submitHandler)}
      className="w-full max-w-2xl mx-auto space-y-5 px-4 sm:px-6"
      noValidate
    >
      {/* Section: Property Details */}
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
        Property Details
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Property Name *"
            placeholder="e.g. Green Valley Apartment"
            {...register('propertyName', { required: 'Property name is required' })}
            error={errors.propertyName?.message}
          />
        </div>
        <div>
          <label className={labelStyle}>Property Type *</label>
          <select
            {...register('propertyType', { required: 'Property type is required' })}
            className={selectStyle}
            onChange={(e) => {
              setValue('propertyType', e.target.value);
              // Reset bhkType and vacateDate when property type changes
              if (!PROPERTY_TYPES_WITH_BHK.includes(e.target.value)) {
                setValue('bhkType', '');
                setValue('vacateDate', '');
              }
            }}
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
      </div>

      {/* BHK Type - shown only for Flat, House, Villa */}
      {showBHK && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>
              Configuration (BHK) *
            </label>
            <select
              {...register('bhkType', {
                validate: (value) => {
                  if (showBHK && !value) return 'Please select a configuration';
                  return true;
                },
              })}
              className={selectStyle}
            >
              <option value="">Select configuration</option>
              {BHK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.bhkType && (
              <p className={errorStyle}>{errors.bhkType.message}</p>
            )}
          </div>
          <div>
            <Input
              label="Vacate Date"
              type="date"
              {...register('vacateDate')}
              error={errors.vacateDate?.message}
            />
          </div>
        </div>
      )}

      <Input
        label="Address *"
        placeholder="Full property address"
        {...register('address', { required: 'Address is required' })}
        error={errors.address?.message}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Asking Rent (₹)"
            type="number"
            placeholder="e.g. 25000"
            {...register('askingRent')}
            error={errors.askingRent?.message}
          />
        </div>
        <div>
          <Input
            label="Selling Price (₹)"
            type="number"
            placeholder="e.g. 5000000"
            {...register('sellingPrice')}
            error={errors.sellingPrice?.message}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Area"
            placeholder="e.g. 1200 sq ft"
            {...register('area')}
            error={errors.area?.message}
          />
        </div>
        <div>
          <label className={labelStyle}>Status</label>
          <select {...register('status')} className={selectStyle}>
            {statusOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelStyle}>Description</label>
        <textarea
          {...register('description')}
          placeholder="Any additional details about the property..."
          rows={3}
          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
        />
      </div>

      {/* F10 — Project / Sector / Unit / Tower / Typology.
          Section disappears entirely when feature.inventory_project_fields
          is off so customers without it see no UI change. */}
      {showProjectFields && (
        <>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2 pt-2">
            Project Identity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Project Name"
              placeholder="e.g. DLF Cyber City"
              {...register('projectName')}
            />
            <Input
              label="Sector"
              placeholder="e.g. Sector 24"
              {...register('sectorNo')}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Tower"
              placeholder="e.g. Tower B"
              {...register('towerNo')}
            />
            <Input
              label="Unit No"
              placeholder="e.g. B-1204"
              {...register('unitNo')}
            />
            <Input
              label="Typology"
              placeholder="e.g. 3BHK + Servant"
              {...register('typology')}
            />
          </div>
        </>
      )}

      {/* F11 — Deal flow: demand, payment, registry/transfer, loan. */}
      {showDealFields && (
        <>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2 pt-2">
            Deal Details
          </h3>
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

      {/* Section: Owner Details */}
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2 pt-2">
        Owner Details
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Owner Name *"
            placeholder="Full name"
            {...register('ownerName', { required: 'Owner name is required' })}
            error={errors.ownerName?.message}
          />
        </div>
        <div>
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
              type="tel"
              {...register('ownerPhone', { required: 'Owner phone is required' })}
              error={errors.ownerPhone?.message}
            />
          )}
        </div>
      </div>

      <Input
        label="Owner Email"
        placeholder="owner@example.com"
        type="email"
        {...register('ownerEmail')}
        error={errors.ownerEmail?.message}
      />

      {/* Submit */}
      <div className="pt-2">
        <Button
          type="submit"
          loading={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Property' : 'Save Property'}
        </Button>
      </div>
    </form>
  );
}
