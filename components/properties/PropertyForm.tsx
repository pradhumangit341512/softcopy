'use client';

import { useState } from 'react';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { X, MapPin, Video, Plus } from 'lucide-react';
import { PropertyType, PropertyStatus, BHK_TYPE_OPTIONS, PROPERTY_TYPES_WITH_BHK } from '@/lib/types';
import { PROPERTY_STATUSES } from '@/lib/constants';
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
  googleMapLink?: string;
  videoPhotoLink?: string;
  mediaUrls?: string[];
  ownerName: string;
  ownerPhone: string;
  /** Extra phone numbers beyond the primary. Server merges with ownerPhone
   * and dedupes; `ownerPhones[0]` always equals `ownerPhone`. */
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
      googleMapLink: initialData?.googleMapLink || '',
      videoPhotoLink: initialData?.videoPhotoLink || '',
      ownerName: initialData?.ownerName || '',
      ownerPhone: initialData?.ownerPhone || '',
      ownerEmail: initialData?.ownerEmail || '',
    },
  });

  const showMultiPhone = useFeature('feature.multi_phone');

  // Media URL list state
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialData?.mediaUrls ?? []);
  const [newMediaUrl, setNewMediaUrl] = useState('');

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

  const addMediaUrl = () => {
    const trimmed = newMediaUrl.trim();
    if (trimmed && !mediaUrls.includes(trimmed)) {
      setMediaUrls((prev) => [...prev, trimmed]);
      setNewMediaUrl('');
    }
  };

  const removeMediaUrl = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const submitHandler: SubmitHandler<PropertyFormValues> = async (data) => {
    // Clear bhkType and vacateDate if property type doesn't support it
    if (!PROPERTY_TYPES_WITH_BHK.includes(data.propertyType)) {
      data.bhkType = undefined;
      data.vacateDate = undefined;
    }
    // Attach media URLs
    data.mediaUrls = mediaUrls.filter(Boolean);
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
      className="w-full max-w-2xl mx-auto space-y-6 px-4 sm:px-6"
      noValidate
    >
      {/* ── 1. Property Details ─────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
          Property Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Listing Name *"
            placeholder="e.g. Green Valley Apartment"
            {...register('propertyName', { required: 'Listing name is required' })}
            error={errors.propertyName?.message}
          />
          <div>
            <label className={labelStyle}>Property Type *</label>
            <select
              {...register('propertyType', { required: 'Property type is required' })}
              className={selectStyle}
              onChange={(e) => {
                setValue('propertyType', e.target.value);
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

        {showBHK && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelStyle}>Configuration (BHK) *</label>
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
            <Input
              label="Vacate Date"
              type="date"
              {...register('vacateDate')}
              error={errors.vacateDate?.message}
            />
          </div>
        )}

        <Input
          label="Address *"
          placeholder="Full property address"
          {...register('address', { required: 'Address is required' })}
          error={errors.address?.message}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Area"
            placeholder="e.g. 1200 sq ft"
            {...register('area')}
            error={errors.area?.message}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Asking Rent (₹)"
            type="number"
            placeholder="e.g. 25000"
            {...register('askingRent')}
            error={errors.askingRent?.message}
          />
          <Input
            label="Selling Price (₹)"
            type="number"
            placeholder="e.g. 5000000"
            {...register('sellingPrice')}
            error={errors.sellingPrice?.message}
          />
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
      </section>

      {/* ── 2. Links & Media ─────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
          Links & Media
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>
              <span className="flex items-center gap-1.5"><MapPin size={14} /> Google Map Link</span>
            </label>
            <input
              {...register('googleMapLink')}
              type="url"
              placeholder="https://maps.google.com/..."
              className={selectStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>
              <span className="flex items-center gap-1.5"><Video size={14} /> Video / Photo Link</span>
            </label>
            <input
              {...register('videoPhotoLink')}
              type="url"
              placeholder="https://youtube.com/... or drive link"
              className={selectStyle}
            />
          </div>
        </div>

        {/* Additional media links */}
        <div>
          <label className={labelStyle}>
            <span className="flex items-center gap-1.5"><Video size={14} /> Additional Photo / Video Links</span>
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={newMediaUrl}
              onChange={(e) => setNewMediaUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMediaUrl(); } }}
              placeholder="Paste image or video URL and click +"
              className={selectStyle}
            />
            <button
              type="button"
              onClick={addMediaUrl}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex-shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>
          {mediaUrls.length > 0 && (
            <div className="mt-2 space-y-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-600 truncate flex-1">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeMediaUrl(i)}
                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Owner Contact ────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-2">
          Owner Contact
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
              type="tel"
              {...register('ownerPhone', { required: 'Owner phone is required' })}
              error={errors.ownerPhone?.message}
            />
          )}
        </div>

        <Input
          label="Owner Email"
          placeholder="owner@example.com"
          type="email"
          {...register('ownerEmail')}
          error={errors.ownerEmail?.message}
        />
      </section>

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
