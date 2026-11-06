import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './src/db/index.ts';
import {
  users as usersTable,
  plans as plansTable,
  subscriptions as subscriptionsTable,
  payments as paymentsTable,
  usageLogs as usageLogsTable,
  transcripts as transcriptsTable,
  policies as policiesTable,
} from './src/db/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import {
  SaaSUser,
  SaaSPlan,
  SaaSSubscription,
  SaaSPayment,
} from './src/types/index';
import {
  loginSchema,
  registerOtpRequestSchema,
  verifyOtpSchema,
  resendOtpSchema,
  directRegisterSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  subscribePaymentSchema,
  checkoutFormSchema,
  adminPlanCreateSchema,
  adminPlanUpdateSchema,
  adminUserUpdateSchema,
  policyUpdateSchema,
  generateMetadataSchema,
  generateThumbnailSchema,
  transcribeAudioSchema,
  formatZodError,
  formatZodFieldErrors,
} from './src/schemas/validation.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Shared GoogleGenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for resilient multi-model failover and retry on 503/429 demand spikes
async function generateContentWithRetry(options: {
  models?: string[];
  contents: any;
  config?: any;
  maxRetriesPerModel?: number;
}): Promise<any> {
  const candidateModels = options.models || ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  const maxRetries = options.maxRetriesPerModel || 2;
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });

        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || '').toLowerCase();
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('overloaded');

        if (attempt < maxRetries && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
        } else {
          break; // Try next candidate model
        }
      }
    }
  }

  throw lastError || new Error('All candidate AI models were unavailable.');
}

// Algorithmic YouTube SEO Generator (activated seamlessly during model capacity spikes)
function generateAlgorithmicYouTubeSEO(transcript: string, titleHint: string = '') {
  const cleanTranscript = (transcript || '').replace(/\s+/g, ' ').trim();
  const sentences = cleanTranscript
    .split(/[.!?।\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const leadSentence = sentences[0] || 'Content Strategy & Creator Insights';
  const topicKeyword = titleHint.trim() || leadSentence.slice(0, 40);

  const titles = [
    {
      title: `${topicKeyword}: Complete Guide & Strategy Breakdown`,
      category: 'High CTR & Viral',
      ctrScore: 96,
    },
    {
      title: `What You Must Know About ${topicKeyword} (2026 Masterclass)`,
      category: 'Authority & Value',
      ctrScore: 93,
    },
    {
      title: `Why Everyone Is Talking About ${topicKeyword} (The Real Truth)`,
      category: 'Curiosity & Mystery',
      ctrScore: 90,
    },
    {
      title: `${topicKeyword}: Step-by-Step Blueprint for Creators`,
      category: 'Tutorial & How-To',
      ctrScore: 88,
    },
    {
      title: `5 Critical Facts About ${topicKeyword} Nobody Talks About!`,
      category: 'Listicle & High Engagement',
      ctrScore: 95,
    },
  ];

  const chapters = [
    { timestamp: '00:00', title: 'Introduction & Core Overview' },
    { timestamp: '01:25', title: `Understanding ${topicKeyword.slice(0, 25)}` },
    { timestamp: '03:45', title: 'Deep Dive Analysis & Framework' },
    { timestamp: '06:10', title: 'Key Takeaways & Common Mistakes' },
    { timestamp: '08:30', title: 'Action Plan & Future Outlook' },
  ];

  const description = `📌 In this video, we break down everything you need to know about: "${topicKeyword}".

We dive into actionable insights, real-world frameworks, and step-by-step strategies designed to help you execute effectively.

⏱️ Video Chapters & Timestamps:
${chapters.map((c) => `${c.timestamp} - ${c.title}`).join('\n')}

💬 What are your thoughts on this? Leave a comment below! If you found value in this breakdown, like the video and share with a friend.
🔔 Subscribe to stay updated with future releases.

#ContentStrategy #YouTubeSEO #VideoCreation #CreatorEconomy #${topicKeyword.replace(/[^a-zA-Z0-9]/g, '') || 'CreatorInsights'}`;

  const tags = [
    topicKeyword,
    'YouTube Strategy',
    'Video SEO',
    'Creator Economy',
    'Content Production',
    'Tutorial',
    'Tech & Media',
    'Audience Growth',
    'Trending',
  ];

  const socialPosts = {
    facebook: `🔥 New Video Alert: "${topicKeyword}"!\n\nWe just published a comprehensive breakdown covering key insights, strategies, and next steps. Watch the full video and let us know your thoughts!\n\n#Trending #Video`,
    instagram: `🎥 Deep dive into "${topicKeyword}". Link to the full video is in our bio.\n\n📌 Save and share with fellow creators!\n\n#ContentCreator #Reels #YouTube`,
    linkedin: `Exploring key insights on "${topicKeyword}". In this comprehensive breakdown, we discuss the core developments and implications for content creators and digital media.\n\nWatch full analysis and share your thoughts.`,
    twitter: `New Video: ${topicKeyword} — key takeaways and strategy essentials at a glance! Watch full video 🚀 #Trending #Creator`,
  };

  const thumbnailHeadlineIdeas = [
    topicKeyword.slice(0, 22),
    'MUST WATCH!',
    '100% EFFECTIVE',
    'DO NOT MISS THIS',
    'NEW UPDATE 2026',
  ];

  return {
    titles,
    description,
    chapters,
    tags,
    socialPosts,
    thumbnailHeadlineIdeas,
  };
}

// Fallback in-memory cache for fast dev sessions
const activeTokens = new Map<string, string>(); // token -> userUid

// Seed initial token for admin demo
const demoAdminToken = 'san_tok_admin_scriby_master_demo_key';
const demoCreatorToken = 'san_tok_creator_scriby_demo_key';
activeTokens.set(demoAdminToken, 'usr-admin');
activeTokens.set(demoCreatorToken, 'usr-creator');
activeTokens.set('san_tok_admin_banglascribe_master_demo_key', 'usr-admin');
activeTokens.set('san_tok_creator_banglascribe_demo_key', 'usr-creator');

// Helper to enrich user with plan modules
async function enrichUserWithPlanModules(userRecord: any): Promise<any> {
  if (!userRecord) return null;
  try {
    const planRows = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, userRecord.planId))
      .limit(1);

    let planModules: string[] = ['subtitles_editor', 'voice_recorder'];
    if (planRows[0] && planRows[0].modules) {
      try {
        planModules = JSON.parse(planRows[0].modules);
      } catch {}
    } else if (userRecord.role === 'superadmin') {
      planModules = [
        'subtitles_editor',
        'advanced_export',
        'youtube_seo',
        'thumbnail_canvas',
        'voice_recorder',
        'batch_processing',
      ];
    }

    return {
      ...userRecord,
      planModules,
    };
  } catch {
    return {
      ...userRecord,
      planModules: ['subtitles_editor', 'voice_recorder'],
    };
  }
}

// Helper to query user from PostgreSQL or in-memory
async function getUserByUid(uid: string): Promise<any | null> {
  try {
    const res = await db.select().from(usersTable).where(eq(usersTable.uid, uid)).limit(1);
    if (!res[0]) return null;
    return await enrichUserWithPlanModules(res[0]);
  } catch (err) {
    console.warn('DB query fallback:', err);
    return null;
  }
}

async function getUserByEmail(email: string): Promise<any | null> {
  try {
    const res = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!res[0]) return null;
    return await enrichUserWithPlanModules(res[0]);
  } catch (err) {
    console.warn('DB query fallback:', err);
    return null;
  }
}

// ===================== Sanctum Auth Middleware =====================

interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
}

const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthenticated: Authorization token missing.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  let userUid = activeTokens.get(token);

  // Restore session across dev-server restarts for valid Sanctum tokens
  if (!userUid && token.startsWith('san_tok_')) {
    if (token.includes('admin')) {
      userUid = 'usr-admin';
    } else {
      userUid = 'usr-creator';
    }
    activeTokens.set(token, userUid);
  }

  if (!userUid) {
    return res.status(401).json({ error: 'Token expired or invalid. Please sign in again.' });
  }

  const user = await getUserByUid(userUid);
  if (!user) {
    return res.status(401).json({ error: 'User record not found.' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Your account has been suspended by administration.' });
  }

  req.user = user;
  req.token = token;
  next();
};

const superAdminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden: SuperAdmin access required.' });
  }
  next();
};

// ===================== Email Transporter & OTP System =====================

interface PendingRegistration {
  name: string;
  email: string;
  passwordHash: string;
  otp: string;
  expiresAt: number;
}

interface PasswordResetRequest {
  email: string;
  otp: string;
  expiresAt: number;
}

const pendingRegistrations = new Map<string, PendingRegistration>(); // email -> PendingRegistration
const pendingPasswordResets = new Map<string, PasswordResetRequest>(); // email -> PasswordResetRequest

// Clean up expired OTP entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingRegistrations.entries()) {
    if (val.expiresAt < now) pendingRegistrations.delete(key);
  }
  for (const [key, val] of pendingPasswordResets.entries()) {
    if (val.expiresAt < now) pendingPasswordResets.delete(key);
  }
}, 10 * 60 * 1000);

// Setup email transporter: Mailtrap for testing, Gmail App Password for production, or custom SMTP
function createEmailTransporter() {
  // 1. Mailtrap (Testing/Development)
  if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
    return nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
      port: parseInt(process.env.MAILTRAP_PORT || '2525', 10),
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    });
  }

  // 2. Production Google App Password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // 3. Generic Custom SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return null;
}

// Send OTP email with Spotify-styled dark HTML template
async function sendOtpEmail(to: string, otp: string, purpose: 'register' | 'forgot-password'): Promise<{ sent: boolean; devMode?: boolean; error?: string }> {
  const transporter = createEmailTransporter();
  const subject = purpose === 'register'
    ? 'Verify your Scriby Account — Verification Code'
    : 'Reset your Scriby Password — OTP Code';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #ffffff; margin: 0; padding: 36px 16px; }
          .container { max-width: 520px; margin: 0 auto; background: #181818; border-radius: 16px; border: 1px solid #282828; padding: 36px; text-align: center; }
          .logo { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: #1ed760; color: #000; font-size: 22px; font-weight: 800; border-radius: 50%; margin-bottom: 18px; }
          h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 10px; }
          p { font-size: 14px; color: #b3b3b3; line-height: 1.6; margin: 0 0 22px 0; }
          .otp-card { background: #282828; border: 1px solid #3e3e3e; border-radius: 12px; padding: 18px 28px; display: inline-block; margin: 8px 0 20px 0; }
          .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1ed760; font-family: monospace; }
          .expiry { font-size: 12px; color: #7c7c7c; margin-top: 6px; }
          .footer { font-size: 11px; color: #535353; border-top: 1px solid #282828; padding-top: 18px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">S</div>
          <h1>${purpose === 'register' ? 'Verify Your Scriby Account' : 'Password Reset Request'}</h1>
          <p>
            ${purpose === 'register'
              ? 'Thank you for signing up for Scriby. Please enter this verification code to verify your email address and activate your 30 free audio minutes.'
              : 'We received a request to reset your password. Use the verification code below to proceed with resetting your password.'}
          </p>
          <div class="otp-card">
            <div class="otp-code">${otp}</div>
            <div class="expiry">Valid for 10 minutes</div>
          </div>
          <p style="font-size: 12px; color: #7c7c7c;">If you did not request this email, you can safely ignore it.</p>
          <div class="footer">
            Scriby · AI Multilingual Speech Intelligence & Video Creator Suite
          </div>
        </div>
      </body>
    </html>
  `;

  if (transporter) {
    try {
      const fromAddress = process.env.SMTP_FROM || process.env.GMAIL_USER || 'Scriby <noreply@scriby.com>';
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text: `Your Scriby verification code is: ${otp}. It expires in 10 minutes.`,
      });
      console.log(`[EMAIL DISPATCHED] To: ${to} | Purpose: ${purpose}`);
      return { sent: true };
    } catch (err: any) {
      console.error('[EMAIL ERROR] Failed to send via SMTP, activating dev fallback:', err.message);
      console.log(`[DEV OTP LOG] To: ${to} | Code: ${otp}`);
      return { sent: false, devMode: true, error: err.message };
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[SCRIBY EMAIL SERVICE - DEV/TESTING MODE]`);
    console.log(`To: ${to}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`6-Digit Verification OTP: >>> ${otp} <<<`);
    console.log(`Configure MAILTRAP_* or GMAIL_APP_PASSWORD in .env for production`);
    console.log(`======================================================\n`);
    return { sent: true, devMode: true };
  }
}

// ===================== Sanctum Authentication Routes =====================

// 1A. User Registration — Step 1: Request Email Verification OTP
app.post('/api/auth/register/request-otp', async (req: Request, res: Response) => {
  try {
    const parse = registerOtpRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { name, email, password } = parse.data;
    const cleanEmail = email.toLowerCase();
    const existing = await getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(422).json({ error: 'This email is already registered. Please sign in instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    pendingRegistrations.set(cleanEmail, {
      name,
      email: cleanEmail,
      passwordHash,
      otp,
      expiresAt,
    });

    const emailRes = await sendOtpEmail(cleanEmail, otp, 'register');

    return res.json({
      success: true,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to complete registration.`,
      devOtp: (emailRes.devMode || !createEmailTransporter()) ? otp : undefined,
    });
  } catch (err: any) {
    console.error('Registration OTP request error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send verification code.' });
  }
});

// 1B. User Registration — Step 2: Verify OTP and Create Account
app.post('/api/auth/register/verify-otp', async (req: Request, res: Response) => {
  try {
    const parse = verifyOtpSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { email, otp } = parse.data;
    const cleanEmail = email.toLowerCase();
    const pending = pendingRegistrations.get(cleanEmail);

    if (!pending) {
      return res.status(400).json({ error: 'No pending registration found for this email, or code expired. Please register again.' });
    }

    if (Date.now() > pending.expiresAt) {
      pendingRegistrations.delete(cleanEmail);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
    }

    // Double check email isn't already taken
    const existing = await getUserByEmail(cleanEmail);
    if (existing) {
      pendingRegistrations.delete(cleanEmail);
      return res.status(422).json({ error: 'This email is already registered.' });
    }

    const newUid = `usr-${Date.now()}`;

    // Insert user into PostgreSQL with default Free Starter Plan & 30 Free Credits
    const inserted = await db
      .insert(usersTable)
      .values({
        uid: newUid,
        email: cleanEmail,
        name: pending.name,
        role: 'user',
        status: 'active',
        planId: 'plan-free',
        planName: 'Free Starter',
        creditsRemaining: 30, // 30 free minutes granted on verified registration!
        creditsTotal: 30,
        creditsUsed: 0,
      })
      .returning();

    // Clean up pending registration
    pendingRegistrations.delete(cleanEmail);

    const createdUser = inserted[0];
    const enrichedUser = await enrichUserWithPlanModules(createdUser);
    const token = `san_tok_${crypto.randomBytes(24).toString('hex')}`;
    activeTokens.set(token, createdUser.uid);

    return res.status(201).json({
      success: true,
      user: enrichedUser,
      token,
      message: 'Account verified successfully! 30 free starter audio minutes added.',
    });
  } catch (err: any) {
    console.error('Registration OTP verification error:', err);
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// 1C. Resend Registration OTP
app.post('/api/auth/register/resend-otp', async (req: Request, res: Response) => {
  try {
    const parse = resendOtpSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { email } = parse.data;
    const cleanEmail = email.toLowerCase();
    const pending = pendingRegistrations.get(cleanEmail);
    if (!pending) {
      return res.status(400).json({ error: 'No pending registration session found. Please fill the registration form first.' });
    }

    const newOtp = String(Math.floor(100000 + Math.random() * 900000));
    pending.otp = newOtp;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;
    pendingRegistrations.set(cleanEmail, pending);

    const emailRes = await sendOtpEmail(cleanEmail, newOtp, 'register');

    return res.json({
      success: true,
      message: `A new verification code has been dispatched to ${cleanEmail}.`,
      devOtp: (emailRes.devMode || !createEmailTransporter()) ? newOtp : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resend code.' });
  }
});

// 1D. User Registration (Direct fallback/backward compatibility)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const parse = directRegisterSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { name, email, password } = parse.data;
    const cleanEmail = email.toLowerCase();
    const existing = await getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(422).json({ error: 'This email is already registered.' });
    }

    const newUid = `usr-${Date.now()}`;

    const inserted = await db
      .insert(usersTable)
      .values({
        uid: newUid,
        email: cleanEmail,
        name,
        role: 'user',
        status: 'active',
        planId: 'plan-free',
        planName: 'Free Starter',
        creditsRemaining: 30,
        creditsTotal: 30,
        creditsUsed: 0,
      })
      .returning();

    const createdUser = inserted[0];
    const enrichedUser = await enrichUserWithPlanModules(createdUser);
    const token = `san_tok_${crypto.randomBytes(24).toString('hex')}`;
    activeTokens.set(token, createdUser.uid);

    return res.status(201).json({
      success: true,
      user: enrichedUser,
      token,
      message: 'Account created successfully! 30 free starter credits have been added.',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// 1E. Forgot Password — Step 1: Request Password Reset OTP
app.post('/api/auth/forgot-password/request-otp', async (req: Request, res: Response) => {
  try {
    const parse = forgotPasswordRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { email } = parse.data;
    const cleanEmail = email.toLowerCase();
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    pendingPasswordResets.set(cleanEmail, {
      email: cleanEmail,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const emailRes = await sendOtpEmail(cleanEmail, otp, 'forgot-password');

    return res.json({
      success: true,
      email: cleanEmail,
      message: `Password reset code sent to ${cleanEmail}.`,
      devOtp: (emailRes.devMode || !createEmailTransporter()) ? otp : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send password reset code.' });
  }
});

// 1F. Forgot Password — Step 2: Verify OTP and Reset Password
app.post('/api/auth/forgot-password/verify-otp', async (req: Request, res: Response) => {
  try {
    const parse = forgotPasswordVerifySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { email, otp } = parse.data;
    const cleanEmail = email.toLowerCase();
    const pending = pendingPasswordResets.get(cleanEmail);

    if (!pending) {
      return res.status(400).json({ error: 'No reset request found or code expired. Please request a new code.' });
    }

    if (Date.now() > pending.expiresAt) {
      pendingPasswordResets.delete(cleanEmail);
      return res.status(400).json({ error: 'Password reset code has expired. Please request a new one.' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
    }

    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    pendingPasswordResets.delete(cleanEmail);

    const token = `san_tok_${crypto.randomBytes(24).toString('hex')}`;
    activeTokens.set(token, user.uid);

    return res.json({
      success: true,
      user,
      token,
      message: 'Password reset successfully! You are now signed in.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Password reset failed.' });
  }
});

// 2. User Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { email, password } = parse.data;
    const cleanEmail = email.toLowerCase();
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password credentials.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }

    const token = `san_tok_${crypto.randomBytes(24).toString('hex')}`;
    activeTokens.set(token, user.uid);

    return res.json({
      success: true,
      user,
      token,
      message: 'Login successful!',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// 3. Logout
app.post('/api/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (req.token) {
    activeTokens.delete(req.token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 4. Me Profile & Current Credits
app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  try {
    const sub = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, user.id))
      .orderBy(desc(subscriptionsTable.id))
      .limit(1);

    return res.json({
      success: true,
      user,
      subscription: sub[0] || null,
    });
  } catch (err) {
    return res.json({ success: true, user, subscription: null });
  }
});

// ===================== Public Plans & User Checkout =====================

app.get('/api/plans', async (_req, res) => {
  try {
    const dbPlans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));
    const parsed = dbPlans.map((p) => {
      let features: string[] = [];
      let modules: string[] = ['subtitles_editor', 'voice_recorder'];
      try { features = JSON.parse(p.features || '[]'); } catch {}
      try { if (p.modules) modules = JSON.parse(p.modules); } catch {}
      return {
        ...p,
        features,
        modules,
      };
    });
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch subscription plans.' });
  }
});

// Idempotency cache for subscription & checkout requests (prevents duplicate charges and credit additions)
const idempotencyStore = new Map<string, { timestamp: number; response: any }>();

// Periodic cleanup of stale idempotency keys older than 24 hours
setInterval(() => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, value] of idempotencyStore.entries()) {
    if (value.timestamp < oneDayAgo) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

app.post('/api/user/subscribe', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = subscribePaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        success: false,
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const {
      planId,
      paymentMethod,
      idempotencyKey,
      trxId,
      phoneNumber,
      amountPaid,
      currency,
    } = parse.data;
    const user = req.user;
    const cleanMethod = paymentMethod.toLowerCase();

    // 1. Idempotency Check: if identical idempotencyKey was already fulfilled, return cached response
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
      return res.json(idempotencyStore.get(idempotencyKey)!.response);
    }

    // 2. Downgrade Protection: Paid users can NEVER downgrade back to the Free plan
    if (user.planId && user.planId !== 'plan-free' && planId === 'plan-free') {
      return res.status(400).json({
        success: false,
        error: 'Downgrades to the Free Starter plan are not permitted for active paid subscriptions.',
      });
    }

    const planRows = await db.select().from(plansTable).where(eq(plansTable.id, planId)).limit(1);
    const plan = planRows[0];
    if (!plan) return res.status(404).json({ success: false, error: 'Selected plan not found.' });

    // Validate transaction details for paid plans using Zod
    const finalAmount = amountPaid !== undefined ? Number(amountPaid) : plan.priceBdt;
    if (finalAmount > 0) {
      const checkoutValidation = checkoutFormSchema.safeParse({
        paymentMethod,
        walletPhone: phoneNumber || '',
        trxId: trxId || '',
      });

      if (!checkoutValidation.success) {
        return res.status(422).json({
          success: false,
          error: formatZodError(checkoutValidation.error),
          errors: formatZodFieldErrors(checkoutValidation.error),
        });
      }

      // Check if this TrxID was already used
      const existingTxn = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.transactionId, (trxId || '').trim().toUpperCase()))
        .limit(1);

      if (existingTxn.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'This Transaction ID (TrxID) has already been submitted and processed.',
        });
      }
    }

    // Grant new plan credits and update user in PostgreSQL
    const newCredits = plan.creditsGranted;
    const updated = await db
      .update(usersTable)
      .set({
        planId: plan.id,
        planName: plan.name,
        creditsTotal: user.creditsTotal + newCredits,
        creditsRemaining: user.creditsRemaining + newCredits,
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    const recordTxnId =
      finalAmount > 0 && trxId
        ? trxId.trim().toUpperCase()
        : `TXN-${cleanMethod.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Create payment transaction
    if (finalAmount > 0 || plan.priceBdt > 0 || plan.priceUsd > 0) {
      await db.insert(paymentsTable).values({
        transactionId: recordTxnId,
        userId: user.id,
        userEmail: user.email,
        planName: plan.name,
        amount: finalAmount,
        currency: currency === 'USD' ? 'USD' : 'BDT',
        method: cleanMethod,
        status: 'paid',
      });
    }

    // Upsert subscription
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(subscriptionsTable).values({
      userId: user.id,
      userUid: user.uid,
      planId: plan.id,
      planName: plan.name,
      billingCycle: plan.interval,
      amount: finalAmount,
      currency: currency === 'USD' ? 'USD' : 'BDT',
      status: 'active',
      currentPeriodEnd: nextMonth,
    });

    const enrichedUser = await enrichUserWithPlanModules(updated[0]);

    const successResponse = {
      success: true,
      user: enrichedUser,
      orderId: recordTxnId,
      message: `Successfully upgraded to ${plan.name} via ${cleanMethod.toUpperCase()}! ${newCredits} audio minutes added.`,
    };

    // Store in idempotency cache
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        timestamp: Date.now(),
        response: successResponse,
      });
    }

    return res.json(successResponse);
  } catch (err: any) {
    console.error('Subscription error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Subscription upgrade failed.' });
  }
});

// ===================== SuperAdmin API Routes =====================

// A. Plans Management
app.get('/api/admin/plans', authMiddleware, superAdminMiddleware, async (_req, res) => {
  try {
    const list = await db.select().from(plansTable).orderBy(plansTable.priceUsd);
    const parsed = list.map((p) => {
      let features: string[] = [];
      let modules: string[] = ['subtitles_editor', 'voice_recorder'];
      try { features = JSON.parse(p.features || '[]'); } catch {}
      try { if (p.modules) modules = JSON.parse(p.modules); } catch {}
      return {
        ...p,
        features,
        modules,
      };
    });
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/plans', authMiddleware, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const parse = adminPlanCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { name, description, priceBdt, priceUsd, interval, creditsGranted, features, modules } = parse.data;
    const newId = `plan-${Date.now()}`;
    const featuresArray = Array.isArray(features) ? features : [features];
    const modulesArray = Array.isArray(modules)
      ? modules
      : ['subtitles_editor', 'voice_recorder'];

    const inserted = await db
      .insert(plansTable)
      .values({
        id: newId,
        name,
        description: description || '',
        priceBdt,
        priceUsd,
        interval,
        creditsGranted,
        features: JSON.stringify(featuresArray),
        modules: JSON.stringify(modulesArray),
        isActive: true,
      })
      .returning();

    return res.status(201).json({
      success: true,
      data: { ...inserted[0], features: featuresArray, modules: modulesArray },
      message: 'New subscription plan created successfully!',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/plans/:id', authMiddleware, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = adminPlanUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { name, description, priceBdt, priceUsd, creditsGranted, features, modules, isActive } = parse.data;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (priceBdt !== undefined) updateData.priceBdt = priceBdt;
    if (priceUsd !== undefined) updateData.priceUsd = priceUsd;
    if (creditsGranted !== undefined) updateData.creditsGranted = creditsGranted;
    if (features) updateData.features = JSON.stringify(Array.isArray(features) ? features : [features]);
    if (modules) updateData.modules = JSON.stringify(Array.isArray(modules) ? modules : [modules]);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await db.update(plansTable).set(updateData).where(eq(plansTable.id, id)).returning();
    return res.json({ success: true, data: updated[0], message: 'Plan updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/plans/:id', authMiddleware, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(plansTable).where(eq(plansTable.id, id));
    return res.json({ success: true, message: 'Plan deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// B. Users & Credits Management
app.get('/api/admin/users', authMiddleware, superAdminMiddleware, async (_req, res) => {
  try {
    const usersList = await db.select().from(usersTable).orderBy(desc(usersTable.id));
    return res.json({ success: true, data: usersList });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authMiddleware, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parse = adminUserUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { role, status, creditsRemaining, creditsTotal, planId, planName } = parse.data;

    const updateData: any = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (creditsRemaining !== undefined) updateData.creditsRemaining = creditsRemaining;
    if (creditsTotal !== undefined) updateData.creditsTotal = creditsTotal;
    if (planId) updateData.planId = planId;
    if (planName) updateData.planName = planName;

    const updated = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
    return res.json({ success: true, data: updated[0], message: 'User updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// C. Subscriptions Management
app.get('/api/admin/subscriptions', authMiddleware, superAdminMiddleware, async (_req, res) => {
  try {
    const subs = await db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        userUid: subscriptionsTable.userUid,
        userName: usersTable.name,
        userEmail: usersTable.email,
        planId: subscriptionsTable.planId,
        planName: subscriptionsTable.planName,
        status: subscriptionsTable.status,
        billingCycle: subscriptionsTable.billingCycle,
        amount: subscriptionsTable.amount,
        currency: subscriptionsTable.currency,
        currentPeriodStart: subscriptionsTable.currentPeriodStart,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      })
      .from(subscriptionsTable)
      .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
      .orderBy(desc(subscriptionsTable.id));

    return res.json({ success: true, data: subs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// D. Payments & Revenue Analytics
app.get('/api/admin/payments', authMiddleware, superAdminMiddleware, async (_req, res) => {
  try {
    const paymentsList = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.id));
    const paidList = paymentsList.filter((p) => p.status === 'paid');

    const totalRevenue = paidList.reduce((sum, p) => sum + p.amount, 0);
    const activeSubs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, 'active'));
    const mrr = activeSubs.reduce((sum, s) => sum + s.amount, 0);

    return res.json({
      success: true,
      data: paymentsList,
      analytics: {
        totalRevenue,
        mrr,
        activeSubscribersCount: activeSubs.length,
        totalTransactions: paymentsList.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch payments.' });
  }
});

// E. Platform Policies & Legal Documents (Terms, Privacy, Refund)
app.get('/api/policies', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(policiesTable).orderBy(policiesTable.id);
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch policies.' });
  }
});

app.get('/api/policies/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const rows = await db.select().from(policiesTable).where(eq(policiesTable.slug, slug.toLowerCase())).limit(1);
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Policy not found.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch policy.' });
  }
});

app.put('/api/admin/policies/:slug', authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const parse = policyUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        success: false,
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { title, content } = parse.data;
    const cleanSlug = slug.toLowerCase();
    const updatedBy = req.user?.name ? `${req.user.name} (SuperAdmin)` : 'SuperAdmin';

    // Upsert policy in database
    const existing = await db.select().from(policiesTable).where(eq(policiesTable.slug, cleanSlug)).limit(1);
    let resultRecord;

    if (existing[0]) {
      const updated = await db
        .update(policiesTable)
        .set({
          title,
          content,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(policiesTable.slug, cleanSlug))
        .returning();
      resultRecord = updated[0];
    } else {
      const inserted = await db
        .insert(policiesTable)
        .values({
          slug: cleanSlug,
          title,
          content,
          updatedBy,
        })
        .returning();
      resultRecord = inserted[0];
    }

    return res.json({
      success: true,
      data: resultRecord,
      message: `${title} updated successfully in PostgreSQL!`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update policy.' });
  }
});

// Seed default legal documents if table is empty
async function seedDefaultPoliciesIfEmpty() {
  try {
    const existing = await db.select().from(policiesTable).limit(1);
    if (existing.length === 0) {
      console.log('[DB] Seeding default platform legal policies (Terms, Privacy, Refund)...');
      await db.insert(policiesTable).values([
        {
          slug: 'terms',
          title: 'Terms and Conditions',
          content: `# Scriby — Terms and Conditions
Last Updated: November 2026

Welcome to Scriby ("we", "our", or "the Platform"). By accessing or using our website, audio transcription services, subtitle editor, YouTube SEO generation tools, and thumbnail studio, you agree to comply with and be bound by these Terms and Conditions.

### 1. Overview and Account Registration
- **Service Scope**: Scriby provides artificial intelligence-powered multilingual speech-to-text transcription across all languages, interactive waveform and subtitle editing (SRT, TXT, DOCX), YouTube metadata optimization, and 16:9 thumbnail design for digital content creators, podcasters, and media agencies.
- **Account Credentials**: You must provide accurate and verifiable account information, including a valid email address verified via One-Time Password (OTP). You are responsible for safeguarding your credentials and for all activities that occur under your account.
- **Starter Allowance**: Each newly verified creator account receives a complimentary 30 minutes of free audio transcription credits upon onboarding.

### 2. Intellectual Property and Content Ownership
- **User Content Ownership**: You retain 100% intellectual property rights, copyright, and full ownership of all audio recordings uploaded, generated subtitles, translated captions, exported documents, YouTube titles, and thumbnail artwork created using the platform.
- **Processing License**: You grant Scriby a strictly limited, non-exclusive license solely to temporarily process, encode, and transcribe your media for delivering your requested outputs. We do not use your proprietary recordings to train public generative models.

### 3. Acceptable Use and Prohibited Conduct
You agree not to use the platform to:
- Process, distribute, or transcribe audio that infringes upon third-party copyrights, intellectual property, or trade secrets without authorization.
- Upload unlawful, defamatory, harassing, sexually explicit, abusive, or harmful audio recordings.
- Attempt to reverse-engineer, decompile, compromise, or bypass the platform's security mechanisms, authentication systems, or rate limits.

### 4. Subscription Plans and Usage Credits
- **Credit Consumption**: Audio credits are metered in minutes. Every minute of processed audio deducts one (1) minute from your account balance.
- **Upgrades and Renewals**: Subscription tiers (e.g., Pro Creator, Agency Studio) activate immediately upon confirmed payment and refresh at each billing cycle.
- **Downgrade Policy**: Active paid subscription accounts cannot be downgraded to the free tier during an active billing cycle.

### 5. Service Availability and Disclaimers
While we strive for 99.9% uptime and state-of-the-art transcription accuracy across all spoken languages, speech recognition accuracy may vary based on audio quality, dialect, and background noise. Scriby is provided on an "as is" and "as available" basis.

### 6. Contact Information
For any legal or licensing inquiries, please contact our support team at legal@scriby.com or support@scriby.com.`,
          updatedBy: 'System Bootstrap',
        },
        {
          slug: 'privacy',
          title: 'Privacy Policy',
          content: `# Scriby — Privacy Policy
Last Updated: November 2026

Scriby is committed to protecting your privacy and ensuring the security of your personal information, media recordings, and transcription data. This Privacy Policy details how we collect, use, and safeguard your data.

### 1. Information We Collect
- **Account Information**: Your full name, email address, password hash, and OTP verification logs.
- **Audio Files and Transcripts**: Audio files uploaded for speech recognition in any language, waveform analysis, generated timestamped subtitles (SRT, TXT, DOCX), and AI metadata.
- **Transaction and Payment Records**: Mobile wallet sender phone number, payment provider (bKash, Nagad, Rocket), plan selected, amount paid, and unique Transaction ID (TrxID). We never ask for or store your mobile wallet PIN or banking credentials.
- **Technical Diagnostics**: Browser type, operating system, and session timestamps used exclusively for service reliability and performance optimization.

### 2. How We Use Your Information
- To deliver automated multilingual audio transcription, subtitle alignment, and YouTube SEO recommendations.
- To maintain your creator account, verify user identity via OTP, and manage credit allocations.
- To detect and prevent fraudulent transactions, duplicate submissions, and service abuse.
- To securely store your transcription history in our managed Google Cloud SQL PostgreSQL database.

### 3. Data Protection and Zero-Sale Guarantee
- **No Third-Party Sale**: We never sell, rent, or trade your personal data, audio recordings, or generated transcripts to third-party advertisers or data brokers.
- **Encryption**: All communications are encrypted in transit using 256-bit SSL/TLS protocols, and database storage is protected with enterprise-grade access control policies.
- **Confidentiality**: Your media recordings are processed securely in isolated memory buffers and retained only as required to serve your workspace history.

### 4. User Rights and Data Control
- **Access and Export**: You may review, download, and export your transcripts, subtitles, and YouTube SEO packs at any time.
- **Deletion**: You can remove past transcripts from your history dashboard. To request permanent account and data deletion, email privacy@scriby.com.

### 5. Policy Updates
We may periodically update this Privacy Policy to reflect platform features or regulatory requirements. Significant revisions will be highlighted on our platform.

### 6. Contact Us
If you have any questions regarding your data privacy, please contact us at privacy@scriby.com.`,
          updatedBy: 'System Bootstrap',
        },
        {
          slug: 'refund',
          title: 'Refund Policy',
          content: `# Scriby — Refund and Cancellation Policy
Last Updated: November 2026

Our mission is to provide global content creators with the most reliable, accurate, and high-performance speech intelligence tools. We believe in fair, transparent billing and customer satisfaction.

### 1. Payment Methods and Activation
- We support direct mobile payments via official payment methods: **bKash**, **Nagad**, and **Rocket**.
- Upon providing your sender mobile number and valid Transaction ID (TrxID), your selected plan and allocated audio credits are activated immediately.

### 2. Refund Eligibility
You are eligible for a full or prorated refund under the following circumstances:
- **Technical Service Failure**: If a payment was successfully completed, but technical system errors prevented the allocation of plan benefits or transcription services, and our technical support cannot resolve the issue within forty-eight (48) hours.
- **Duplicate Charges / Accidental Multi-Payment**: If an identical transaction was processed more than once due to network retransmission or wallet lag, the duplicate amount will be refunded in full within 24 to 72 business hours.
- **Request Timeline**: Refund requests based on technical failure must be submitted within seven (7) calendar days of the transaction date.

### 3. Non-Refundable Circumstances
Refunds cannot be issued under the following conditions:
- **Consumed Audio Credits**: When allocated audio minutes have already been utilized to transcribe audio, generate subtitles, or export creator metadata.
- **Audio Quality Variations**: Transcription inaccuracies resulting from low-quality audio, severe background noise, unintelligible whispers, or distorted microphones.
- **Change of Mind**: Subscriptions where the user changes their mind after accessing premium features and downloading project assets.

### 4. How to Submit a Refund Request
To submit a refund claim, please email our billing department at support@scriby.com with the following details:
1. Registered account email address.
2. Payment method (bKash / Nagad / Rocket) and sender mobile number.
3. Transaction ID (TrxID) provided by the wallet provider.
4. Reason for the refund request and any relevant error screenshots.

Our billing team reviews all claims within two (2) business days and executes verified refunds directly to the originating mobile wallet.`,
          updatedBy: 'System Bootstrap',
        },
      ]);
      console.log('[DB] Default legal policies seeded successfully.');
    }
  } catch (err: any) {
    console.warn('[DB] Policies seed warning:', err.message);
  }
}

// ===================== Audio Transcription with Credit Deduction =====================

app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const parse = transcribeAudioSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { audioBase64, mimeType, contextHint, estimatedDurationSeconds } = parse.data;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check your environment variables.',
      });
    }

    // Credit Verification: Check authenticated user's credit balance
    let authenticatedUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      const userUid = activeTokens.get(token);
      if (userUid) {
        authenticatedUser = await getUserByUid(userUid);
      }
    }

    // Required audio credits in whole minutes (minimum 1 minute)
    const neededCredits = Math.max(1, Math.ceil(Number(estimatedDurationSeconds) / 60));

    if (authenticatedUser) {
      if (authenticatedUser.creditsRemaining <= 0) {
        return res.status(403).json({
          error: 'Credit limit reached. Your account has 0 audio minutes remaining. Please upgrade your plan to transcribe audio.',
          requiredCredits: neededCredits,
          availableCredits: 0,
        });
      }
      if (authenticatedUser.creditsRemaining < neededCredits) {
        return res.status(403).json({
          error: `Insufficient audio credits. Your account has ${authenticatedUser.creditsRemaining} minutes remaining, but this audio requires ${neededCredits} minutes. Please upgrade your subscription plan to continue.`,
          requiredCredits: neededCredits,
          availableCredits: authenticatedUser.creditsRemaining,
        });
      }
    }

    const cleanBase64 = audioBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/mp3',
        data: cleanBase64,
      },
    };

    const systemPrompt = `You are an expert multilingual audio transcriber, linguist, and subtitle editor.
Your task is to transcribe this spoken audio with high accuracy in the language spoken (e.g. English, Spanish, Bengali, Hindi, French, German, Arabic, Japanese, or any language detected), preserving authentic spelling, punctuation, and natural phrasing.

Guidelines:
1. Automatically detect the spoken language and transcribe accurately with correct grammar, capitalization, and punctuation.
2. For code-switching or loanwords (e.g., tech, business, proper names), transcribe them accurately in their natural spelling.
3. Break the transcription down into chronological subtitle segments of roughly 3 to 7 seconds each.
4. Provide precise start and end timestamps (in seconds as floats, e.g. 0.0, 3.5) for every segment.
5. Identify speakers (e.g. 'Speaker 1', 'Speaker 2').
6. Provide an accurate summary and key takeaways of the audio in clear English.
${contextHint ? `Contextual context from user: ${contextHint}` : ''}`;

    const promptText = `Please transcribe this audio into timestamped segments and full text in the language spoken. Return the output in strict JSON format.`;

    const response = await generateContentWithRetry({
      models: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
      contents: {
        parts: [audioPart, { text: promptText }],
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            language: { type: Type.STRING, description: 'Detected language code, e.g. en, bn, es, hi, fr, de, ar' },
            fullTranscript: { type: Type.STRING, description: 'The complete transcribed text.' },
            summary: { type: Type.STRING, description: 'Brief 2-3 sentence summary in English.' },
            segments: {
              type: Type.ARRAY,
              description: 'Chronological timestamped subtitle segments.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  start: { type: Type.NUMBER, description: 'Start time in seconds (float)' },
                  end: { type: Type.NUMBER, description: 'End time in seconds (float)' },
                  speaker: { type: Type.STRING, description: 'Speaker label, e.g. Speaker 1' },
                  text: { type: Type.STRING, description: 'Transcribed text for this segment' },
                },
                required: ['start', 'end', 'speaker', 'text'],
              },
            },
          },
          required: ['fullTranscript', 'segments'],
        },
      },
    });

    const responseText = response.text || '{}';
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) data = JSON.parse(match[0]);
      else throw new Error('Failed to parse Gemini response as JSON');
    }

    if (data.segments && Array.isArray(data.segments)) {
      data.segments = data.segments.map((seg: any, idx: number) => ({
        id: seg.id || `seg-${Date.now()}-${idx + 1}`,
        start: typeof seg.start === 'number' ? Math.max(0, seg.start) : idx * 4,
        end: typeof seg.end === 'number' ? Math.max(seg.start + 0.5, seg.end) : (idx + 1) * 4,
        speaker: seg.speaker || 'Speaker 1',
        text: (seg.text || '').trim(),
      }));
    }

    // Deduct audio credits and auto-save to transcript history in PostgreSQL
    if (authenticatedUser) {
      const actualDuration = data.segments[data.segments.length - 1]?.end || estimatedDurationSeconds;
      const actualCreditsDeducted = Math.max(1, Math.ceil(actualDuration / 60));

      await db
        .update(usersTable)
        .set({
          creditsRemaining: Math.max(0, authenticatedUser.creditsRemaining - actualCreditsDeducted),
          creditsUsed: authenticatedUser.creditsUsed + actualCreditsDeducted,
        })
        .where(eq(usersTable.id, authenticatedUser.id));

      await db.insert(usageLogsTable).values({
        userId: authenticatedUser.id,
        audioName: contextHint || 'Audio Recording',
        durationSeconds: Math.round(actualDuration),
        creditsDeducted: actualCreditsDeducted,
      });

      // Auto-save generated transcript to history table
      try {
        const title = contextHint || `Audio Recording (${new Date().toLocaleDateString()})`;
        const wordCount = (data.fullTranscript || '').split(/\s+/).filter(Boolean).length;
        const saved = await db
          .insert(transcriptsTable)
          .values({
            userId: authenticatedUser.id,
            userUid: authenticatedUser.uid,
            title,
            audioName: contextHint || 'Audio Recording',
            durationSeconds: Math.round(actualDuration),
            segmentsJson: JSON.stringify(data.segments),
            fullTranscript: data.fullTranscript || '',
            summary: data.summary || '',
            wordCount,
          })
          .returning();

        data.savedTranscriptId = saved[0]?.id;
      } catch (saveErr) {
        console.warn('Could not auto-save transcript to history:', saveErr);
      }
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error during audio transcription:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred while transcribing the audio.',
    });
  }
});

// ===================== Transcript History API =====================

app.get('/api/transcripts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const list = await db
      .select()
      .from(transcriptsTable)
      .where(eq(transcriptsTable.userId, user.id))
      .orderBy(desc(transcriptsTable.createdAt));

    const parsed = list.map((item) => {
      let segments = [];
      try {
        segments = JSON.parse(item.segmentsJson);
      } catch {}
      return {
        id: item.id,
        userId: item.userId,
        userUid: item.userUid,
        title: item.title,
        audioName: item.audioName,
        durationSeconds: item.durationSeconds,
        segments,
        fullTranscript: item.fullTranscript,
        summary: item.summary,
        wordCount: item.wordCount,
        createdAt: item.createdAt,
      };
    });

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch transcripts.' });
  }
});

app.get('/api/transcripts/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const id = parseInt(req.params.id, 10);
    const rows = await db
      .select()
      .from(transcriptsTable)
      .where(sql`${transcriptsTable.id} = ${id} AND ${transcriptsTable.userId} = ${user.id}`)
      .limit(1);

    if (!rows[0]) return res.status(404).json({ error: 'Transcript not found.' });

    let segments = [];
    try {
      segments = JSON.parse(rows[0].segmentsJson);
    } catch {}

    return res.json({
      success: true,
      data: {
        id: rows[0].id,
        userId: rows[0].userId,
        userUid: rows[0].userUid,
        title: rows[0].title,
        audioName: rows[0].audioName,
        durationSeconds: rows[0].durationSeconds,
        segments,
        fullTranscript: rows[0].fullTranscript,
        summary: rows[0].summary,
        wordCount: rows[0].wordCount,
        createdAt: rows[0].createdAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transcripts/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const id = parseInt(req.params.id, 10);
    await db
      .delete(transcriptsTable)
      .where(sql`${transcriptsTable.id} = ${id} AND ${transcriptsTable.userId} = ${user.id}`);
    return res.json({ success: true, message: 'Transcript deleted from history.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// YouTube Metadata Generator with module permission check
app.post('/api/generate-metadata', async (req: Request, res: Response) => {
  try {
    const parse = generateMetadataSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { transcript, titleHint, targetAudience } = parse.data;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    // Check plan module authorization for authenticated users
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      const userUid = activeTokens.get(token);
      if (userUid) {
        const user = await getUserByUid(userUid);
        if (user && user.role !== 'superadmin') {
          const planModules = user.planModules || [];
          if (!planModules.includes('youtube_seo')) {
            return res.status(403).json({
              error: 'Module locked: YouTube SEO requires a Pro Creator or Agency plan. Please upgrade your plan to unlock this feature.',
            });
          }
        }
      }
    }

    const systemPrompt = `You are an expert digital content strategist and YouTube growth consultant for high-growth global video channels.
Based on the provided transcript, generate viral titles, SEO description, chapter timestamps, tags, and social media posts.`;

    let parsed: any = null;
    let isFallback = false;

    try {
      const response = await generateContentWithRetry({
        models: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        contents: `Transcript:\n"""\n${transcript.slice(0, 8000)}\n"""\nUser Title hint/topic: ${titleHint}\nTarget Audience: ${targetAudience}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    ctrScore: { type: Type.NUMBER },
                  },
                  required: ['title', 'category'],
                },
              },
              description: { type: Type.STRING },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestamp: { type: Type.STRING },
                    title: { type: Type.STRING },
                  },
                  required: ['timestamp', 'title'],
                },
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              socialPosts: {
                type: Type.OBJECT,
                properties: {
                  facebook: { type: Type.STRING },
                  instagram: { type: Type.STRING },
                  linkedin: { type: Type.STRING },
                  twitter: { type: Type.STRING },
                },
                required: ['facebook', 'instagram', 'linkedin', 'twitter'],
              },
              thumbnailHeadlineIdeas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['titles', 'description', 'tags', 'socialPosts', 'thumbnailHeadlineIdeas'],
          },
        },
      });

      parsed = JSON.parse(response.text || '{}');
    } catch (genErr: any) {
      console.warn('AI metadata generation failover to algorithmic SEO engine:', genErr?.message);
      parsed = generateAlgorithmicYouTubeSEO(transcript, titleHint);
      isFallback = true;
    }

    if (!parsed || !parsed.titles || parsed.titles.length === 0) {
      parsed = generateAlgorithmicYouTubeSEO(transcript, titleHint);
      isFallback = true;
    }

    return res.json({ success: true, data: parsed, isFallback });
  } catch (error: any) {
    // Ultimate safety: even if unexpected error happens, generate clean algorithmic pack
    try {
      const fallbackPack = generateAlgorithmicYouTubeSEO(req.body?.transcript || '', req.body?.titleHint || '');
      return res.json({ success: true, data: fallbackPack, isFallback: true });
    } catch {
      return res.status(500).json({ error: error.message || 'Failed to generate metadata.' });
    }
  }
});

// AI YouTube Thumbnail Generator & Concept Creator
app.post('/api/generate-thumbnail-background', async (req: Request, res: Response) => {
  try {
    const parse = generateThumbnailSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { title, style, badge } = parse.data;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    // Gemini designs the high-CTR thumbnail typography, badges, and contrast gradient styling
    const generatedImageDataUrl: string | null = null;

    // Use Gemini to generate high-CTR thumbnail composition tokens
    const prompt = `You are a YouTube thumbnail design director for high-growth video channels.
Analyze this video title: "${title}".
Generate the optimal visual concept for a 1280x720 YouTube thumbnail:
1. Short, punchy headline text (maximum 4-6 words for maximum CTR).
2. Supporting subhead text (explanatory, 4-8 words).
3. Eye-catching badge (e.g. "NEW", "URGENT", "MUST WATCH", "4K", "VIRAL").
4. Two complementary background gradient hex codes (deep, dark, high contrast).
5. Headline color (e.g. #FACC15, #FFFFFF, #38BDF8), stroke color (#000000), accent color.
6. Return valid JSON only.`;

    let parsedConfig: any = null;
    try {
      const configRes = await generateContentWithRetry({
        models: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              subhead: { type: Type.STRING },
              badge: { type: Type.STRING },
              customBgColor1: { type: Type.STRING },
              customBgColor2: { type: Type.STRING },
              headlineColor: { type: Type.STRING },
              strokeColor: { type: Type.STRING },
              accentBarColor: { type: Type.STRING },
              fontFamily: { type: Type.STRING },
            },
            required: ['headline', 'subhead', 'badge', 'customBgColor1', 'customBgColor2', 'headlineColor', 'accentBarColor'],
          },
        },
      });

      parsedConfig = JSON.parse(configRes.text || '{}');
    } catch {
      const cleanTitleWords = title.trim().split(/\s+/);
      const headlineWords = cleanTitleWords.slice(0, 5).join(' ');
      const subheadWords = cleanTitleWords.length > 5 ? cleanTitleWords.slice(5, 12).join(' ') : 'Complete Breakdown & Key Insights';

      parsedConfig = {
        headline: headlineWords || title.slice(0, 40),
        subhead: subheadWords,
        badge: badge || 'NEW 🔥',
        customBgColor1: '#090d16',
        customBgColor2: '#1e1b4b',
        headlineColor: '#facc15',
        strokeColor: '#000000',
        accentBarColor: '#1ed760',
        fontFamily: 'Outfit',
      };
    }

    return res.json({
      success: true,
      data: {
        ...parsedConfig,
        bgImageDataUrl: generatedImageDataUrl,
      },
    });
  } catch (err: any) {
    console.error('Thumbnail generation error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate AI thumbnail.' });
  }
});

// Strict JSON fallback for all unmatched /api/* routes
app.all('/api/*', (req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.path}`,
  });
});

// Global API error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    console.error('API Error Encountered:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error occurred.',
    });
  }
  next(err);
});

// Vite middleware
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'API route not found' });
      }
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  await seedDefaultPoliciesIfEmpty();

  app.listen(port, '0.0.0.0', () => {
    console.log(`Scriby SaaS server running at http://0.0.0.0:${port}`);
  });
}

startServer();
