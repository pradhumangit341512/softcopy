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

export const otpCodeSchema = z.string().regex(/^\d{4,6}$/, 'Invalid OTP');

// ==================== AUTH ====================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
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
    propertyVisited: z.boolean().optional().default(false),
    visitStatus: z.string().optional().default('NotVisited'),
    // Admin can assign a client to a specific team member.
    // If omitted, defaults to the logged-in user (self-assign).
    assignedTo: objectIdSchema.optional(),
  })
  .strict();

export const updateClientSchema = z
  .object({
    clientName: z.string().trim().min(2).optional(),
    phone: z.string().trim().optional(),
    email: z.union([emailSchema, z.literal('')]).optional().nullable().transform((v) => v || null),
    companyName: optionalString,
    requirementType: z.string().trim().optional(),
    inquiryType: z.string().trim().optional(),
    budget: z.union([z.coerce.number(), z.literal(''), z.null()]).optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    preferredLocation: optionalString,
    address: optionalString,
    visitingTime: optionalString,
    status: z.string().optional(),
    source: optionalString,
    notes: optionalString,
    visitingDate: optionalDate,
    followUpDate: optionalDate,
    nextFollowUp: optionalDate,
    lastContactDate: optionalDate,
    propertyVisited: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
    visitStatus: z.string().optional(),
    assignedTo: objectIdSchema.optional(),
  })
  .strip();

/**
 * Restricted schema for team members (role='user') editing their own clients.
 * They cannot move a client to terminal business states (DealDone, etc.) or
 * rewrite history fields — only admins can.
 */
export const updateClientByTeamMemberSchema = updateClientSchema.omit({
  status: true,
  visitStatus: true,
  assignedTo: true,
});

// ==================== COMMISSION ====================

/**
 * Commission creation schema. `paidStatus` is derived from the payment
 * ledger, not an input, so it's absent here. An OPTIONAL `initialPayment`
 * block lets the caller record the first instalment in the same request
 * — common when a deal closes with a token advance paid on the spot.
 */
export const createCommissionSchema = z
  .object({
    clientId: objectIdSchema,
    salesPersonName: optionalString,
    // Optional builder/developer counterparty. Free-text; not a master record.
    builderName: optionalString,
    dealAmount: z.coerce.number().positive('Enter valid deal amount'),
    commissionPercentage: z.coerce.number().min(0).max(100),
    paymentReference: optionalString,
    initialPayment: z
      .object({
        amount: z.coerce.number().positive('Initial payment amount must be > 0'),
        paidOn: z
          .union([z.string(), z.date()])
          .transform((v) => new Date(v))
          .refine((d) => !isNaN(d.getTime()), 'Invalid date'),
        method: z
          .enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other'])
          .optional()
          .nullable()
          .transform((v) => v || null),
        reference: optionalString,
        notes: optionalString,
      })
      .optional(),
  })
  .strict();

/**
 * Partial update on commission metadata. `initialPayment` and any
 * payment-status fields are omitted — payments are managed exclusively
 * via the `/api/commissions/:id/payments` routes so the running total
 * stays in sync with the ledger.
 */
export const updateCommissionSchema = createCommissionSchema
  .partial()
  .omit({ initialPayment: true })
  .strip();

/**
 * Stages a buyer→builder deal payment can belong to. Fixed enum (rather
 * than free text) so the by-stage report stays sane and totals roll up
 * cleanly. "Other" is the escape hatch for anything that doesn't fit.
 */
export const DEAL_PAYMENT_STAGES = [
  'Token',
  'Agreement',
  'Registry',
  'LoanDisbursed',
  'Possession',
  'Other',
] as const;

/**
 * One buyer→builder instalment recorded against a deal. Distinct from
 * CommissionPayment (builder→broker). The route layer caps amount so
 * dealAmountPaid never exceeds dealAmount.
 */
export const createDealPaymentSchema = z
  .object({
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    paidOn: z
      .union([z.string(), z.date()])
      .transform((v) => new Date(v))
      .refine((d) => !isNaN(d.getTime()), 'Invalid date'),
    stage: z.enum(DEAL_PAYMENT_STAGES),
    method: z
      .enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other'])
      .optional()
      .nullable()
      .transform((v) => v || null),
    reference: optionalString,
    notes: optionalString,
  })
  .strict();

export type CreateDealPaymentInput = z.infer<typeof createDealPaymentSchema>;

/**
 * One participant in a commission's payout pie. participantUserId is null
 * when the participant is an external co-broker or an ex-employee whose
 * user record was removed — participantName carries the human label.
 *
 * sharePercent is bounded 0..100. The route layer accepts splits whose
 * sum is anything (a soft "splits don't add to 100%" warning is returned
 * but never blocks the save).
 */
export const createCommissionSplitSchema = z
  .object({
    participantUserId: objectIdSchema.optional().nullable(),
    participantName: z.string().trim().min(1, 'Participant name is required'),
    sharePercent: z.coerce.number().min(0).max(100),
  })
  .strict();

export const updateCommissionSplitSchema = z
  .object({
    participantUserId: objectIdSchema.optional().nullable(),
    participantName: z.string().trim().min(1).optional(),
    sharePercent: z.coerce.number().min(0).max(100).optional(),
  })
  .strict();

/**
 * One brokerage→participant payout against a single split. The route caps
 * amount so paidOut never exceeds shareAmount (with a small EPS tolerance).
 */
export const createCommissionSplitPayoutSchema = z
  .object({
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    paidOn: z
      .union([z.string(), z.date()])
      .transform((v) => new Date(v))
      .refine((d) => !isNaN(d.getTime()), 'Invalid date'),
    method: z
      .enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other'])
      .optional()
      .nullable()
      .transform((v) => v || null),
    reference: optionalString,
    notes: optionalString,
  })
  .strict();

export type CreateCommissionSplitInput = z.infer<typeof createCommissionSplitSchema>;
export type UpdateCommissionSplitInput = z.infer<typeof updateCommissionSplitSchema>;
export type CreateCommissionSplitPayoutInput = z.infer<typeof createCommissionSplitPayoutSchema>;


/**
 * One payment recorded against a commission. Amount must be positive;
 * the route layer additionally caps it so paidAmount never exceeds
 * commissionAmount.
 */
export const createCommissionPaymentSchema = z
  .object({
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    paidOn: z
      .union([z.string(), z.date()])
      .transform((v) => new Date(v))
      .refine((d) => !isNaN(d.getTime()), 'Invalid date'),
    method: z
      .enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other'])
      .optional()
      .nullable()
      .transform((v) => v || null),
    reference: optionalString,
    notes: optionalString,
  })
  .strict();

export type CreateCommissionPaymentInput = z.infer<typeof createCommissionPaymentSchema>;

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

export const updatePropertySchema = createPropertySchema.partial().strip();

// ==================== BUDGET ====================

export const monthlyBudgetSchema = z.object({
  // YYYY-MM format — covers 2000-01 through 2099-12
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM (e.g. 2026-04)'),
  targetAmount: z.coerce.number().nonnegative('Target must be ≥ 0'),
});

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

/**
 * Admin/superadmin updating another user in the same company.
 *
 * `password` is accepted but the route layer further restricts WHO may set it
 * on WHICH target — only superadmin may reset admin passwords, admins may only
 * reset team-member passwords. Email is similarly gated at the route layer.
 */
export const updateUserByAdminSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    role: z.enum(['admin', 'user']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    password: passwordSchema.optional(),
  })
  .strict();

/**
 * User updating their own profile. Email and password are deliberately absent:
 * email changes go through an admin/superadmin, password changes go through
 * the OTP-gated /api/auth/reset-password flow.
 */
export const updateSelfSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    phone: phoneSchema.optional(),
    profilePhoto: z.string().url().optional(),
  })
  .strict();

// Legacy alias — keep so existing imports don't break; prefer the split schemas.
export const updateUserSchema = updateUserByAdminSchema;

// ==================== ONBOARDING ENQUIRY (public) ====================

/**
 * Shape of the public landing-page "Request onboarding" form. Validates
 * strictly enough to keep junk out of the DB but leans permissive on the
 * optional fields — a visitor shouldn't be blocked because they formatted
 * their phone number differently.
 */
export const onboardingEnquirySchema = z.object({
  name:     z.string().trim().min(2, 'Name is required').max(120),
  company:  z.string().trim().min(1, 'Company is required').max(200),
  email:    emailSchema,
  phone:    z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  city:     z.string().trim().max(80).optional().nullable().transform((v) => v || null),
  teamSize: z
    .enum(['1', '2-5', '6-15', '16+'])
    .optional()
    .nullable()
    .transform((v) => v || null),
  plan:     z
    .enum(['Solo', 'Team', 'Enterprise'])
    .optional()
    .nullable()
    .transform((v) => v || null),
  message:  z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  consent:  z.literal(true, { message: 'Consent is required.' }),
  // Bot honeypot — must be empty. Any non-empty value means an automated
  // form filler hit us, so we silently accept + drop the submission.
  hp:       z.string().max(0).optional().default(''),
}).strict();

export type OnboardingEnquiryInput = z.infer<typeof onboardingEnquirySchema>;

// ==================== SUPERADMIN ====================

/**
 * SuperAdmin creating a new broker company + its admin user in one transaction.
 * The admin gets a generated temporary password they must change on first login.
 */
export const createCompanyWithAdminSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  plan: z.enum(['standard', 'pro', 'enterprise', 'custom']).default('standard'),
  seatLimit: z.number().int().min(1).max(1000).default(5),
  monthlyFee: z.number().nonnegative().nullable().optional(),
  subscriptionUntil: z
    .union([z.string(), z.date()])
    .transform((v) => new Date(v))
    .refine((d) => !isNaN(d.getTime()), 'Invalid subscription end date'),
  notes: optionalString,
  // Admin user fields
  adminName: z.string().trim().min(2, 'Admin name is required'),
  adminEmail: emailSchema,
  adminPhone: phoneSchema,
  // Optional: caller can provide a temp password; otherwise we generate one.
  adminTempPassword: passwordSchema.optional(),
}).strict();

export const updateCompanyBySuperAdminSchema = z.object({
  companyName: z.string().trim().min(2).optional(),
  plan: z.enum(['standard', 'pro', 'enterprise', 'custom']).optional(),
  seatLimit: z.number().int().min(1).max(1000).optional(),
  monthlyFee: z.number().nonnegative().nullable().optional(),
  subscriptionUntil: z
    .union([z.string(), z.date()])
    .transform((v) => new Date(v))
    .optional(),
  status: z.enum(['active', 'suspended', 'expired']).optional(),
  notes: optionalString,
}).strict();

export const recordPaymentSchema = z.object({
  companyId: objectIdSchema,
  amount: z.number().positive('Amount must be > 0'),
  paidOn: z
    .union([z.string(), z.date()])
    .transform((v) => new Date(v)),
  coversFrom: z
    .union([z.string(), z.date()])
    .transform((v) => new Date(v)),
  coversUntil: z
    .union([z.string(), z.date()])
    .transform((v) => new Date(v)),
  method: z.enum(['bank_transfer', 'razorpay_link', 'cash', 'cheque', 'upi', 'other']),
  reference: optionalString,
  notes: optionalString,
}).strict().refine(
  (d) => d.coversUntil > d.coversFrom,
  { message: 'coversUntil must be after coversFrom', path: ['coversUntil'] }
);

// ==================== TYPES ====================

export type LoginInput = z.infer<typeof loginSchema>;
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
export type CreateCompanyWithAdminInput = z.infer<typeof createCompanyWithAdminSchema>;
export type UpdateCompanyBySuperAdminInput = z.infer<typeof updateCompanyBySuperAdminSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

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
  // Lazy-import to avoid a circular import at module load (errors.ts uses
  // NextResponse, validations.ts is imported by everything).
  const { ErrorCode, apiError } = await import('./errors');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: apiError(ErrorCode.VALIDATION_INVALID_JSON, 'Invalid JSON body'),
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
    const summary = summaryPath ? `${summaryPath}: ${first.message}` : first.message;

    return {
      ok: false,
      response: apiError(ErrorCode.VALIDATION_FAILED, summary, { fields, root: rootErrors }),
    };
  }

  return { ok: true, data: parsed.data };
}
