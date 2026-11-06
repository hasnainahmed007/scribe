import { z } from 'zod';

// ============================================================================
// 1. Authentication Form Schemas
// ============================================================================

/**
 * Sign In Form Schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address (e.g. name@example.com).')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Please enter your password.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * User Registration Step 1: Request OTP Schema
 */
export const registerOtpRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(80, 'Full name cannot exceed 80 characters.'),
    email: z
      .string()
      .trim()
      .min(1, 'Please enter a valid email address.')
      .email('Please enter a valid email address (e.g. name@example.com).')
      .toLowerCase(),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters.')
      .max(100, 'Password cannot exceed 100 characters.'),
    password_confirmation: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.password_confirmation === undefined) return true;
      return data.password === data.password_confirmation;
    },
    {
      message: 'Password confirmation does not match.',
      path: ['password_confirmation'],
    }
  );

export type RegisterOtpRequestInput = z.infer<typeof registerOtpRequestSchema>;

/**
 * User Registration Step 2: Verify OTP Schema
 */
export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required for verification.')
    .email('Please provide a valid email address.')
    .toLowerCase(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits.'),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Resend Registration OTP Schema
 */
export const resendOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required to resend verification code.')
    .email('Please provide a valid email address.')
    .toLowerCase(),
});

export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

/**
 * Direct Registration (Backward Compatibility)
 */
export const directRegisterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(80, 'Full name cannot exceed 80 characters.'),
    email: z
      .string()
      .trim()
      .min(1, 'Please enter a valid email address.')
      .email('Please enter a valid email address.')
      .toLowerCase(),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters.')
      .max(100, 'Password cannot exceed 100 characters.'),
    password_confirmation: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.password_confirmation === undefined) return true;
      return data.password === data.password_confirmation;
    },
    {
      message: 'Password confirmation does not match.',
      path: ['password_confirmation'],
    }
  );

export type DirectRegisterInput = z.infer<typeof directRegisterSchema>;

/**
 * Forgot Password Step 1: Request Reset OTP Schema
 */
export const forgotPasswordRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your registered email address.')
    .email('Please enter a valid email address.')
    .toLowerCase(),
});

export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;

/**
 * Forgot Password Step 2: Verify OTP & Reset Password Schema
 */
export const forgotPasswordVerifySchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Email is required.')
      .email('Please enter a valid email address.')
      .toLowerCase(),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits.'),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
    new_password: z.string().optional(),
    confirm_password: z.string().optional(),
  })
  .transform((data) => ({
    email: data.email,
    otp: data.otp,
    newPassword: data.newPassword || data.new_password || '',
    confirmPassword:
      data.confirmPassword !== undefined
        ? data.confirmPassword
        : data.confirm_password !== undefined
        ? data.confirm_password
        : data.newPassword || data.new_password || '',
  }))
  .refine((data) => data.newPassword.length >= 6, {
    message: 'New password must be at least 6 characters long.',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Password confirmation does not match.',
    path: ['confirmPassword'],
  });

export type ForgotPasswordVerifyInput = z.infer<typeof forgotPasswordVerifySchema>;

// ============================================================================
// 2. Subscription & Direct Wallet Checkout Schemas
// ============================================================================

export const PAYMENT_METHODS = ['bkash', 'nagad', 'rocket'] as const;
export const BILLING_INTERVALS = ['monthly', 'yearly'] as const;
export const CURRENCIES = ['BDT', 'USD'] as const;
export const USER_ROLES = ['user', 'superadmin'] as const;
export const USER_STATUSES = ['active', 'suspended', 'trial'] as const;

/**
 * Client-Side Checkout Modal Form Validation
 */
export const checkoutFormSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  walletPhone: z
    .string()
    .trim()
    .regex(/^01[3-9]\d{8}$/, 'Please enter a valid 11-digit mobile number (01XXXXXXXXX).'),
  trxId: z
    .string()
    .trim()
    .min(6, 'Transaction ID (TrxID) must be at least 6 characters.')
    .max(50, 'Transaction ID is too long.'),
});

export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;

/**
 * Server-Side Subscription API Request Schema
 */
export const subscribePaymentSchema = z.object({
  planId: z.string().min(1, 'Please select a valid plan.'),
  paymentMethod: z.enum(PAYMENT_METHODS).default('bkash'),
  amountPaid: z.coerce.number().min(0).optional(),
  currency: z.enum(CURRENCIES).default('BDT'),
  trxId: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  idempotencyKey: z.string().optional(),
  billingCycle: z.enum(BILLING_INTERVALS).default('monthly'),
});

export type SubscribePaymentInput = z.infer<typeof subscribePaymentSchema>;

// ============================================================================
// 3. SuperAdmin Governance Schemas
// ============================================================================

export const adminPlanCreateSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters.'),
  description: z.string().optional().default(''),
  priceBdt: z.coerce.number().min(0, 'BDT price must be 0 or greater.'),
  priceUsd: z.coerce.number().min(0, 'USD price must be 0 or greater.'),
  interval: z.enum(BILLING_INTERVALS).default('monthly'),
  creditsGranted: z.coerce.number().int().positive('Audio minutes granted must be at least 1.'),
  features: z.union([z.array(z.string()), z.string()]).optional().default([]),
  modules: z.array(z.string()).optional().default(['subtitles_editor', 'voice_recorder']),
});

export type AdminPlanCreateInput = z.infer<typeof adminPlanCreateSchema>;

export const adminPlanUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters.').optional(),
  description: z.string().optional(),
  priceBdt: z.coerce.number().min(0).optional(),
  priceUsd: z.coerce.number().min(0).optional(),
  interval: z.enum(BILLING_INTERVALS).optional(),
  creditsGranted: z.coerce.number().int().positive().optional(),
  features: z.union([z.array(z.string()), z.string()]).optional(),
  modules: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type AdminPlanUpdateInput = z.infer<typeof adminPlanUpdateSchema>;

export const adminUserUpdateSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  creditsRemaining: z.coerce.number().int().min(0).optional(),
  creditsTotal: z.coerce.number().int().min(0).optional(),
  planId: z.string().optional(),
  planName: z.string().optional(),
});

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

export const policyUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Policy title must be at least 2 characters.')
    .max(120, 'Policy title cannot exceed 120 characters.'),
  content: z
    .string()
    .trim()
    .min(10, 'Policy content must be at least 10 characters.'),
});

export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please provide your name (at least 2 characters).')
    .max(100, 'Name is too long.'),
  email: z
    .string()
    .trim()
    .min(1, 'Please provide your email address.')
    .email('Please enter a valid email address (e.g. name@example.com).')
    .toLowerCase(),
  subject: z.string().trim().max(150, 'Subject is too long.').optional().default(''),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters long.')
    .max(3000, 'Message cannot exceed 3000 characters.'),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

// ============================================================================
// 4. Studio AI & Metadata Generation Schemas
// ============================================================================

export const generateMetadataSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(3, 'Transcript text must be provided to generate YouTube SEO metadata.'),
  titleHint: z.string().optional().default(''),
  targetAudience: z.string().optional().default('Global Digital Creators & Audience'),
});

export type GenerateMetadataInput = z.infer<typeof generateMetadataSchema>;

export const generateThumbnailSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Video title must be at least 2 characters.'),
  style: z.string().optional().default('bold'),
  badge: z.string().optional().default('NEW'),
});

export type GenerateThumbnailInput = z.infer<typeof generateThumbnailSchema>;

export const transcribeAudioSchema = z
  .object({
    audioBase64: z.string().optional(),
    audio: z.string().optional(),
    mimeType: z.string().optional().default('audio/mp3'),
    contextHint: z.string().optional().default(''),
    estimatedDurationSeconds: z.coerce.number().positive().optional().default(60),
  })
  .refine((data) => Boolean(data.audioBase64 || data.audio), {
    message: 'Missing audio payload.',
    path: ['audioBase64'],
  })
  .transform((data) => ({
    audioBase64: (data.audioBase64 || data.audio)!,
    mimeType: data.mimeType,
    contextHint: data.contextHint,
    estimatedDurationSeconds: data.estimatedDurationSeconds,
  }));

export type TranscribeAudioInput = z.infer<typeof transcribeAudioSchema>;

// ============================================================================
// 5. Zod Error Formatting & Helper Utilities
// ============================================================================

/**
 * Extracts the single cleanest human-readable error message from a ZodError
 */
export function formatZodError(error: z.ZodError): string {
  if (!error.issues || error.issues.length === 0) {
    return 'Invalid form data. Please check your inputs.';
  }
  return error.issues[0].message;
}

/**
 * Extracts field-level mapped errors { [field]: 'Error message' }
 */
export function formatZodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : '_global';
    if (!result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

/**
 * Generic safe parsing helper for API route handlers and forms
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
    errors: formatZodFieldErrors(result.error),
  };
}
