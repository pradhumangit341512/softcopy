import { z } from 'zod';
import { NextResponse } from 'next/server';

// ==================== PRIMITIVES ====================

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address');

/**
 * Accepts phone numbers with spaces, dashes, or parens.
 * Normalizes to compact E.164 before validating.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'));

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number');

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => v || null);

const otpCodeSchema = z.string().regex(/^\d{4,6}$/, 'Invalid OTP');

// ==================== AUTH ====================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  otp: otpCodeSchema.optional(),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  companyName: z.string().trim().min(2, 'Company name is required'),
  otp: otpCodeSchema.optional(),
});

export const sendResetOtpSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: otpCodeSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const sendSmsOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifySmsOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpCodeSchema,
});

// ==================== CLIENT ====================

export const createClientSchema = z
  .object({
    clientName: z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: phoneSchema,
    email: z
      .union([emailSchema, z.literal('')])
      .optional()
      .transform((v) => v || null),
    companyName: optionalString,
    requirementType: z.string().trim().min(1, 'Select requirement type'),
    inquiryType: z.string().trim().min(1, 'Select inquiry type'),
    budget: z
      .union([z.coerce.number().positive(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    preferredLocation: optionalString,
    address: optionalString,
    visitingTime: optionalString,
    status: z.string().optional().default('New'),
    source: optionalString,
    notes: optionalString,
    visitingDate: optionalDate,
    followUpDate: optionalDate,
    // Fields the form also submits at create time (not just edit)
    propertyVisited: z.boolean().optional().default(false),
    visitStatus: z.string().optional().default('NotVisited'),
  })
  .strict();

export const updateClientSchema = createClientSchema.partial().extend({
  propertyVisited: z.boolean().optional(),
  visitStatus: z.string().optional(),
  nextFollowUp: optionalDate,
  lastContactDate: optionalDate,
});

/**
 * Restricted schema for team members (role='user') editing their own clients.
 * They cannot move a client to terminal business states (DealDone, etc.) or
 * rewrite history fields — only admins can.
 */
export const updateClientByTeamMemberSchema = updateClientSchema.omit({
  status: true,
  visitStatus: true,
});

// ==================== COMMISSION ====================

export const createCommissionSchema = z
  .object({
    clientId: objectIdSchema,
    salesPersonName: optionalString,
    dealAmount: z.coerce.number().positive('Enter valid deal amount'),
    commissionPercentage: z.coerce.number().min(0).max(100),
    paidStatus: z.enum(['Pending', 'Paid']).optional().default('Pending'),
    paymentReference: optionalString,
  })
  .strict();

export const updateCommissionSchema = createCommissionSchema.partial();

// ==================== PROPERTY ====================

export const createPropertySchema = z
  .object({
    propertyName: z.string().trim().min(2),
    address: z.string().trim().min(2),
    propertyType: z.string().trim().min(1),
    bhkType: optionalString,
    vacateDate: optionalDate,
    askingRent: z
      .union([z.coerce.number().nonnegative(), z.literal('')])
      .optional()
      .nullable()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    sellingPrice: z
      .union([z.coerce.number().nonnegative(), z.literal('')])
      .optional()
      .nullable()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    area: optionalString,
    description: optionalString,
    status: z.string().optional().default('Available'),
    ownerName: z.string().trim().min(2),
    ownerPhone: phoneSchema,
    ownerEmail: z
      .union([emailSchema, z.literal('')])
      .optional()
      .transform((v) => v || null),
  })
  .strict();

export const updatePropertySchema = createPropertySchema.partial();

// ==================== USER ====================

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    role: z.enum(['admin', 'user']),
  })
  .strict();

/** Admin updating another user in the same company. */
export const updateUserByAdminSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    role: z.enum(['admin', 'user']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

/** User updating their own profile — cannot change role or status. */
export const updateSelfSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    phone: phoneSchema.optional(),
    profilePhoto: z.string().url().optional(),
  })
  .strict();

// Legacy alias — keep so existing imports don't break; prefer the split schemas.
export const updateUserSchema = updateUserByAdminSchema;

// ==================== TYPES ====================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateCommissionInput = z.infer<typeof createCommissionSchema>;
export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserByAdminInput = z.infer<typeof updateUserByAdminSchema>;
export type UpdateSelfInput = z.infer<typeof updateSelfSchema>;

// ==================== HELPER ====================

/**
 * Parse a JSON body against a Zod schema.
 *
 * On failure returns a 400 response with:
 *   - `error` — human-friendly summary (first issue) so clients that only read
 *     `error` still show something useful
 *   - `fields` — map of `path -> message` for form libraries that highlight
 *     per-field errors
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    const rootErrors: string[] = [];
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (path) fields[path] = issue.message;
      else rootErrors.push(issue.message);
    }
    const first = parsed.error.issues[0];
    const summaryPath = first.path.join('.');
    const summary = summaryPath
      ? `${summaryPath}: ${first.message}`
      : first.message;

    return {
      ok: false,
      response: NextResponse.json(
        { error: summary, fields, root: rootErrors },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
