'use client';

import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { clientSchema } from '@/schemas/client.schema';

import {
  RequirementType,
  InquiryType,
  ClientStatus,
  ClientFormData,
} from '@/lib/types';

import Input from '@/components/common/ Input';
import Button from '@/components/common/ Button';

/* ================= TYPES ================= */

// form values come from zod schema
type FormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  onSubmit: (data: ClientFormData) => Promise<boolean>;
  initialData?: Partial<FormValues>;
  isLoading?: boolean;
}

export default function ClientForm({
  onSubmit,
  initialData,
  isLoading = false,
}: ClientFormProps) {

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(clientSchema) as unknown as Resolver<FormValues>, // 🔥 fix
    defaultValues: initialData,
  });

  const submitHandler: SubmitHandler<FormValues> = async (data) => {
    const formatted: ClientFormData = {
      ...data,
      visitingDate: data.visitingDate
        ? new Date(data.visitingDate)
        : undefined,
      followUpDate: data.followUpDate
        ? new Date(data.followUpDate)
        : undefined,
    };

    await onSubmit(formatted);
  };

  const selectStyle = `
    w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white
    text-gray-900 font-semibold shadow-sm appearance-none
    focus:outline-none focus:ring-2 focus:ring-blue-500
    focus:border-blue-500 transition
  `;

  return (
    <form
      onSubmit={handleSubmit(submitHandler)}
      className="space-y-6 bg-white p-8 rounded-xl shadow-lg"
    >
      {/* CLIENT NAME */}
      <Input
        label="Client Name"
        placeholder="Enter full name"
        {...register('clientName')}
        error={errors.clientName?.message}
      />

      {/* PHONE */}
      <Input
        label="Phone"
        placeholder="Enter phone number"
        {...register('phone')}
        error={errors.phone?.message}
      />

      {/* EMAIL */}
      <Input
        label="Email"
        placeholder="Enter email address"
        {...register('email')}
        error={errors.email?.message}
      />

      {/* REQUIREMENT */}
      <div>
        <label className="block mb-2 font-medium text-gray-800">
          Requirement Type
        </label>
        <select {...register('requirementType')} className={selectStyle}>
          <option value="">Select Requirement</option>
          {Object.values(RequirementType).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {errors.requirementType && (
          <p className="text-red-500 text-sm mt-1">
            {errors.requirementType.message}
          </p>
        )}
      </div>

      {/* INQUIRY */}
      <div>
        <label className="block mb-2 font-medium text-gray-800">
          Inquiry Type
        </label>
        <select {...register('inquiryType')} className={selectStyle}>
          <option value="">Select Inquiry</option>
          {Object.values(InquiryType).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {errors.inquiryType && (
          <p className="text-red-500 text-sm mt-1">
            {errors.inquiryType.message}
          </p>
        )}
      </div>

      {/* STATUS */}
      <div>
        <label className="block mb-2 font-medium text-gray-800">Status</label>
        <select {...register('status')} className={selectStyle}>
          {Object.values(ClientStatus).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {/* BUDGET */}
      <Input
        label="Budget"
        type="number"
        placeholder="Enter budget amount"
        {...register('budget', { valueAsNumber: true })}
        error={errors.budget?.message}
      />

      {/* LOCATION */}
      <Input
        label="Preferred Location"
        placeholder="Enter preferred location"
        {...register('preferredLocation')}
      />

      {/* ADDRESS */}
      <Input
        label="Address"
        placeholder="Enter property address"
        {...register('address')}
      />

      {/* VISITING DATE */}
      <Input label="Visiting Date" type="date" {...register('visitingDate')} />

      {/* VISITING TIME */}
      <Input label="Visiting Time" type="time" {...register('visitingTime')} />

      {/* FOLLOW UP */}
      <Input label="Follow Up Date" type="date" {...register('followUpDate')} />

      {/* SOURCE */}
      <Input
        label="Source"
        placeholder="Facebook, Walk-in, Referral..."
        {...register('source')}
      />

      {/* NOTES */}
      <Input
        label="Notes"
        placeholder="Add additional notes"
        {...register('notes')}
      />

      <Button
        type="submit"
        loading={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
      >
        Save Client
      </Button>
    </form>
  );
}