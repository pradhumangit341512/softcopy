'use client';

import { useState } from 'react';
import { useForm, SubmitHandler, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { clientSchema } from '@/schemas/client.schema';
import {
  RequirementType,
  InquiryType,
  ClientStatus,
  Client,
} from '@/lib/types';
import { LEAD_STATUSES, LEAD_SOURCES } from '@/lib/constants';
import { useFeature } from '@/hooks/useFeature';

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

interface TeamMemberOption {
  id: string;
  name: string;
}

interface ClientFormProps {
  onSubmit: (data: Partial<Client> & { assignedTo?: string }) => Promise<boolean>;
  initialData?: Partial<Client>;
  isLoading?: boolean;
  isAdmin?: boolean;
  teamMembers?: TeamMemberOption[];
  currentUserId?: string;
}

/** Client creation/edit form with Zod validation and date handling */
export function ClientForm({
  onSubmit,
  initialData,
  isLoading = false,
  isAdmin = false,
  teamMembers = [],
  currentUserId,
}: ClientFormProps) {

  const [assignedTo, setAssignedTo] = useState(
    (initialData as Record<string, unknown>)?.createdBy as string ?? ''
  );

  // F6 — extended status taxonomy (Hot / NotConnected / Serious / etc.).
  // When the company doesn't have the feature, fall back to the legacy
  // 4-value ClientStatus enum so behaviour is unchanged.
  const useExtendedStatuses = useFeature('feature.extended_lead_statuses');
  const statusValues: ReadonlyArray<string> = useExtendedStatuses
    ? LEAD_STATUSES
    : Object.values(ClientStatus);
  // Always preserve the current value as a selectable option even if it's
  // not in the active list — protects legacy rows from silently switching
  // to whatever happens to be the first option.
  const initialStatus = initialData?.status ?? 'New';
  const statusOptions = statusValues.includes(initialStatus)
    ? statusValues
    : [initialStatus, ...statusValues];

  // F8 — preset source dropdown via <datalist>. Users can still type a
  // custom value (long-tail sources stay supported) but get autocomplete
  // for the canonical list.
  const useSourcePresets = useFeature('feature.source_presets');

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
    resolver: zodResolver(formSchema) as unknown as Resolver<ClientFormValues>,
    defaultValues: cleanDefaults as Partial<ClientFormValues> | undefined,
  });

  const submitHandler: SubmitHandler<ClientFormValues> = async (data) => {
    const payload: Partial<Client> & { assignedTo?: string } = {
      ...data,
      visitingDate: data.visitingDate ? new Date(data.visitingDate) : undefined,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    };
    if (isAdmin && assignedTo && assignedTo !== currentUserId) {
      payload.assignedTo = assignedTo;
    }
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
            label="Lead Name *"
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
            {statusOptions.map((v) => (
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

      {/* ── Assign to team member (admin only) ── */}
      {isAdmin && teamMembers.length > 0 && (
        <div>
          <label className={labelStyle}>Assign to Team Member</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className={selectStyle}
          >
            <option value="">Myself (default)</option>
            {teamMembers.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name} {tm.id === currentUserId ? '(You)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            This client will appear in the selected member&apos;s work dashboard
          </p>
        </div>
      )}

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
        placeholder={useSourcePresets ? 'Pick a source or type a custom one' : 'e.g. Website, Referral'}
        list={useSourcePresets ? 'lead-source-options' : undefined}
        {...register('source')}
        error={errors.source?.message}
      />
      {useSourcePresets && (
        <datalist id="lead-source-options">
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}

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