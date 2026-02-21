import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number');

export const clientSchema = z.object({
  clientName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  requirementType: z.string().min(1, 'Select requirement type'),
  inquiryType: z.string().min(1, 'Select inquiry type'),
  budget: z.coerce.number().positive().optional(),
  visitingDate: z.string().optional(),
});

export const commissionSchema = z.object({
  clientId: z.string().min(1, 'Select client'),
  dealAmount: z.coerce.number().positive('Enter valid amount'),
  commissionPercentage: z.coerce.number().min(0).max(100),
});