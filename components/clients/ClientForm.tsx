'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { clientSchema } from '@/schemas/client.schema';
import {
  RequirementType,
  InquiryType,
  ClientStatus,
  Client,
} from '@/lib/types';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

// Extend schema to allow string dates (HTML date inputs always return strings)
// Use .passthrough() instead of .strict() so extra fields from initialData
// (id, companyId, createdAt, etc.) don't cause silent validation failures
const formSchema = clientSchema.extend({
  visitingDate: z.string().optional(),
  followUpDate: z.string().optional(),
});

type ClientFormValues = z.infer<typeof formSchema>;

interface ClientFormProps {
  onSubmit: (data: Partial<Client>) => Promise<boolean>;
  initialData?: Partial<Client>;
  isLoading?: boolean;
}

/** Client creation/edit form with Zod validation and date handling */
export function ClientForm({
  onSubmit,
  initialData,
  isLoading = false,
}: ClientFormProps) {

  // Pick only the fields the form uses — prevents extra API fields
  // (id, companyId, createdAt, etc.) from leaking into form state
  const cleanDefaults = initialData
    ? {
        clientName:        initialData.clientName ?? '',
        phone:             initialData.phone ?? '',
        email:             initialData.email ?? '',
        companyName:       initialData.companyName ?? '',
        requirementType:   initialData.requirementType ?? '',
        inquiryType:       initialData.inquiryType ?? '',
        budget:            initialData.budget,
        preferredLocation: initialData.preferredLocation ?? '',
        address:           initialData.address ?? '',
        visitingDate:      initialData.visitingDate
          ? new Date(initialData.visitingDate).toISOString().split('T')[0]
          : '',
        visitingTime:      (initialData as Record<string, unknown>).visitingTime as string ?? '',
        followUpDate:      initialData.followUpDate
          ? new Date(initialData.followUpDate).toISOString().split('T')[0]
          : '',
        status:            initialData.status ?? 'New',
        source:            initialData.source ?? '',
        notes:             initialData.notes ?? '',
        propertyVisited:   initialData.propertyVisited ?? false,
        visitStatus:       initialData.visitStatus ?? 'NotVisited',
      }
    : undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: cleanDefaults as Partial<ClientFormValues> | undefined,
  });

  // ✅ Convert strings → Date objects before sending to API
  const submitHandler: SubmitHandler<ClientFormValues> = async (data) => {
    const payload: Partial<Client> = {
      ...data,
      visitingDate: data.visitingDate ? new Date(data.visitingDate) : undefined,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    };
    await onSubmit(payload);
  };

  // ✅ Shared styles — responsive and consistent
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';
  const selectStyle =
    'w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
  const errorStyle = 'text-red-500 text-xs mt-1';

  return (
    <form
      onSubmit={handleSubmit(submitHandler as SubmitHandler<Record<string, unknown>>)}
      className="w-full max-w-2xl mx-auto space-y-5 px-4 sm:px-6"
      noValidate
    >

      {/* ── Personal Info ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Client Name *"
            placeholder="Full name"
            {...register('clientName')}
            error={errors.clientName?.message}
          />
        </div>
        <div>
          <Input
            label="Phone *"
            placeholder="+91 XXXXX XXXXX"
            type="tel"
            {...register('phone')}
            error={errors.phone?.message}
          />
        </div>
      </div>

      <Input
        label="Email"
        placeholder="client@example.com"
        type="email"
        {...register('email')}
        error={errors.email?.message}
      />

      {/* ── Requirement & Inquiry ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div>
          <label className={labelStyle}>Requirement Type *</label>
          <select {...register('requirementType')} className={selectStyle}>
            <option value="">Select type</option>
            {Object.values(RequirementType).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {errors.requirementType && (
            <p className={errorStyle}>{errors.requirementType.message}</p>
          )}
        </div>

        <div>
          <label className={labelStyle}>Inquiry Type *</label>
          <select {...register('inquiryType')} className={selectStyle}>
            <option value="">Select type</option>
            {Object.values(InquiryType).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {errors.inquiryType && (
            <p className={errorStyle}>{errors.inquiryType.message}</p>
          )}
        </div>

      </div>

      {/* ── Status & Property Visited ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div>
          <label className={labelStyle}>Status *</label>
          <select {...register('status')} className={selectStyle}>
            {Object.values(ClientStatus).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {errors.status && (
            <p className={errorStyle}>{errors.status.message}</p>
          )}
        </div>

        <div>
          <label className={labelStyle}>Property Visited?</label>
          <select
            {...register('propertyVisited', {
              // ✅ Convert string "true"/"false" → boolean
              setValueAs: (v) => v === 'true',
            })}
            className={selectStyle}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>

      </div>

      {/* ── Budget & Location ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Budget (₹)"
            type="number"
            placeholder="e.g. 5000000"
            {...register('budget', {
              // ✅ Empty string → undefined, otherwise parse as number
              setValueAs: (v) => (v === '' ? undefined : Number(v)),
            })}
            error={errors.budget?.message}
          />
        </div>
        <div>
          <Input
            label="Preferred Location"
            placeholder="e.g. Bandra West"
            {...register('preferredLocation')}
            error={errors.preferredLocation?.message}
          />
        </div>
      </div>

      <Input
        label="Address"
        placeholder="Full address"
        {...register('address')}
        error={errors.address?.message}
      />

      {/* ── Dates ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Visiting Date"
            type="date"
            {...register('visitingDate')}
            error={errors.visitingDate?.message}
          />
        </div>
        <div>
          <Input
            label="Follow Up Date"
            type="date"
            {...register('followUpDate')}
            error={errors.followUpDate?.message}
          />
        </div>
      </div>

      {/* ── Source & Notes ── */}
      <Input
        label="Source"
        placeholder="e.g. Website, Referral"
        {...register('source')}
        error={errors.source?.message}
      />

      <Input
        label="Notes"
        placeholder="Any additional details..."
        {...register('notes')}
        error={errors.notes?.message}
      />

      {/* ── Submit ── */}
      <div className="pt-2">
        <Button
          type="submit"
          loading={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? 'Saving...' : 'Save Client'}
        </Button>
      </div>

    </form>
  );
}