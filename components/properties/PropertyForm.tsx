'use client';

import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { PropertyType, PropertyStatus, BHK_TYPE_OPTIONS, PROPERTY_TYPES_WITH_BHK } from '@/lib/types';
import Input from '@/components/common/ Input';
import Button from '@/components/common/ Button';

interface PropertyFormValues {
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
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
}

interface PropertyFormProps {
  onSubmit: (data: any) => Promise<boolean>;
  initialData?: any;
  isLoading?: boolean;
}

export default function PropertyForm({
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
      ownerName: initialData?.ownerName || '',
      ownerPhone: initialData?.ownerPhone || '',
      ownerEmail: initialData?.ownerEmail || '',
    },
  });

  // Watch propertyType to conditionally show BHK selector
  const selectedPropertyType = useWatch({ control, name: 'propertyType' });
  const showBHK = PROPERTY_TYPES_WITH_BHK.includes(selectedPropertyType);

  const submitHandler: SubmitHandler<PropertyFormValues> = async (data) => {
    // Clear bhkType and vacateDate if property type doesn't support it
    if (!PROPERTY_TYPES_WITH_BHK.includes(data.propertyType)) {
      data.bhkType = undefined;
      data.vacateDate = undefined;
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
            {Object.values(PropertyStatus).map((v) => (
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
          <Input
            label="Owner Phone *"
            placeholder="+91 XXXXX XXXXX"
            type="tel"
            {...register('ownerPhone', { required: 'Owner phone is required' })}
            error={errors.ownerPhone?.message}
          />
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
