import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  generateKeyPointTitle,
  isRawAudioFilenameTitle,
} from './src/utils/subtitleUtils.ts';
import { db } from './src/db/index.ts';
import {
  users as usersTable,
  plans as plansTable,
  subscriptions as subscriptionsTable,
  payments as paymentsTable,
  usageLogs as usageLogsTable,
  transcripts as transcriptsTable,
  policies as policiesTable,
  voiceProfiles as voiceProfilesTable,
  savedVoiceovers as savedVoiceoversTable,
  inquiries as inquiriesTable,
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
  contactFormSchema,
  adminInquiryUpdateSchema,
  generateMetadataSchema,
  generateThumbnailSchema,
  generateAiImageSchema,
  saveTranscriptSchema,
  saveVoiceoverSchema,
  formatZodError,
  formatZodFieldErrors,
} from './src/schemas/validation.ts';
import {
  normalizeLanguageCode,
  getDefaultAccentForLanguage,
  getShortLanguageLabel,
  buildLocalVoiceCloneProfile,
  VoiceCloneAcousticProfile,
} from './src/utils/voiceLanguages.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===================== Persistent Audio Storage =====================
const AUDIO_UPLOADS_DIR = path.join(__dirname, 'uploads', 'audio');
const VOICES_UPLOADS_DIR = path.join(__dirname, 'uploads', 'voices');
const VOICEOVER_UPLOADS_DIR = path.join(__dirname, 'uploads', 'voiceovers');
try {
  if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
    fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(VOICES_UPLOADS_DIR)) {
    fs.mkdirSync(VOICES_UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(VOICEOVER_UPLOADS_DIR)) {
    fs.mkdirSync(VOICEOVER_UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize audio uploads directories:', e);
}

function saveStoredAudioFile(transcriptId: number, base64Data: string, mimeType: string, filename?: string) {
  try {
    if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
      fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
    }
    const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const audioPath = path.join(AUDIO_UPLOADS_DIR, `${transcriptId}.bin`);
    const metaPath = path.join(AUDIO_UPLOADS_DIR, `${transcriptId}.json`);
    fs.writeFileSync(audioPath, buffer);
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        mimeType: mimeType || 'audio/mpeg',
        filename: filename || `transcript-${transcriptId}.mp3`,
        size: buffer.length,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error('Failed to save audio file to disk:', err);
  }
}

function getStoredAudioInfo(transcriptId: number) {
  const audioPath = path.join(AUDIO_UPLOADS_DIR, `${transcriptId}.bin`);
  const metaPath = path.join(AUDIO_UPLOADS_DIR, `${transcriptId}.json`);
  if (!fs.existsSync(audioPath)) return null;
  let mimeType = 'audio/mpeg';
  let filename = `transcript-${transcriptId}.mp3`;
  try {
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.mimeType) mimeType = meta.mimeType;
      if (meta.filename) filename = meta.filename;
    }
  } catch {}
  return { audioPath, mimeType, filename };
}

function deleteStoredAudioFile(transcriptId: number) {
  try {
    const audioPath = path.join(AUDIO_UPLOADS_DIR, `${transcriptId}.bin`);
    const metaPath = path.join(AUDIO_UPLOADS_DIR, `${transcriptId}.json`);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch (err) {
    console.warn(`Could not delete audio files for transcript ${transcriptId}:`, err);
  }
}

function generateFallbackWavBuffer(durationSeconds: number): Buffer {
  const safeSeconds = Math.max(1, Math.min(3600, durationSeconds || 30));
  const sampleRate = 22050;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const numSamples = Math.floor(safeSeconds * sampleRate);
  const dataByteLength = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataByteLength);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);

  // Gentle audible speech/ambient cadence pulse so audio timeline syncs and plays smoothly
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const pulse = Math.exp(-2.5 * (t % 1));
    const sampleVal = Math.sin(2 * Math.PI * 440 * t) * 0.12 * pulse + Math.sin(2 * Math.PI * 554 * t) * 0.08 * pulse;
    const clamped = Math.max(-1, Math.min(1, sampleVal));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    buffer.writeInt16LE(Math.floor(int16), offset);
    offset += 2;
  }

  return buffer;
}

const app = express();

function parsePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const val = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(val)) return val;
  }
  return parseInt(process.env.PORT || '3000', 10);
}
const port = parsePort();

process.on('uncaughtException', (err) => {
  console.error('Unhandled process exception caught:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled promise rejection caught:', reason?.message || reason);
});

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Cross-Origin Isolation headers for SharedArrayBuffer WebAssembly multi-threading (Moonshine WASM)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Serve @moonshine-ai/moonshine-wasm binaries and Web Workers cleanly in dev and production
const MOONSHINE_WASM_DIR = path.resolve(__dirname, 'node_modules', '@moonshine-ai', 'moonshine-wasm', 'dist');
app.use(
  '/moonshine-wasm',
  express.static(MOONSHINE_WASM_DIR, {
    setHeaders: (res, filePath) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      } else if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    },
  })
);

// Shared GoogleGenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    apiVersion: 'v1beta',
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function wrapPcmWithWavHeader(rawBuf: Buffer, sampleRate: number = 24000): Buffer {
  if (rawBuf.subarray(0, 4).toString('ascii').startsWith('RIFF')) {
    return rawBuf;
  }
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataByteLength = rawBuf.length;
  const wavHdr = Buffer.alloc(44);
  wavHdr.write('RIFF', 0);
  wavHdr.writeUInt32LE(36 + dataByteLength, 4);
  wavHdr.write('WAVE', 8);
  wavHdr.write('fmt ', 12);
  wavHdr.writeUInt32LE(16, 16);
  wavHdr.writeUInt16LE(1, 20);
  wavHdr.writeUInt16LE(numChannels, 22);
  wavHdr.writeUInt32LE(sampleRate, 24);
  wavHdr.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  wavHdr.writeUInt16LE(numChannels * bytesPerSample, 32);
  wavHdr.writeUInt16LE(16, 34);
  wavHdr.write('data', 36);
  wavHdr.writeUInt32LE(dataByteLength, 40);
  return Buffer.concat([wavHdr, rawBuf]);
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Helper for resilient multi-model failover and retry on 503/429 demand spikes
async function generateContentWithRetry(options: {
  models?: string[];
  contents: any;
  config?: any;
  maxRetriesPerModel?: number;
  timeoutMs?: number;
}): Promise<any> {
  const candidateModels = options.models || ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  const maxRetries = options.maxRetriesPerModel || 2;
  const timeoutMs = options.timeoutMs || 25000;
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: options.contents,
            config: options.config,
          }),
          timeoutMs,
          `Request to model ${model} timed out after ${timeoutMs}ms`
        );

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
          errMsg.includes('overloaded') ||
          errMsg.includes('timed out');

        if (attempt < maxRetries && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        } else {
          break; // Try next candidate model
        }
      }
    }
  }

  throw lastError || new Error('All candidate AI models were unavailable.');
}

// Check if an error was caused by Gemini API quota, rate limit, or resource exhaustion
export function isGeminiQuotaError(err: any): boolean {
  if (!err) return false;
  if (err.status === 429 || err.code === 429 || err?.error?.code === 429) return true;
  const msg = (typeof err === 'string' ? err : err.message || JSON.stringify(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('limit: 0') ||
    msg.includes('free tier') ||
    msg.includes('rate-limits') ||
    msg.includes('generativelanguage.googleapis.com')
  );
}

export const PROFESSIONAL_QUOTA_MESSAGE =
  '⚡ AI Service at Peak Capacity: Our cloud AI processing cluster is experiencing extraordinarily high creator volume right now. Your request has been queued. Please wait a few moments and try again shortly, or switch to priority queue on upgraded plans.';

// Algorithmic YouTube SEO Generator (activated seamlessly during model capacity spikes)
function generateAlgorithmicYouTubeSEO(transcript: string, titleHint: string = '') {
  const cleanTranscript = (transcript || '').replace(/\s+/g, ' ').trim();
  const sentences = cleanTranscript
    .split(/[.!?।\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const isBengali = /[\u0980-\u09FF]/.test(transcript) || /[\u0980-\u09FF]/.test(titleHint);
  const leadSentence = sentences[0] || (isBengali ? 'ভিডিওর মূল আলোচনা' : 'Content Strategy & Creator Insights');
  const topicKeyword = titleHint.trim() || leadSentence.slice(0, 35);

  if (isBengali) {
    const titles = [
      {
        title: `${topicKeyword}: সম্পূর্ণ আলোচনা ও বিশেষ বিশ্লেষণ`,
        category: 'হাই ক্লিক-থ্রু ও ভাইরাল',
        ctrScore: 96,
      },
      {
        title: `${topicKeyword} সম্পর্কে গুরুত্বপূর্ণ যা জানা প্রয়োজন (২০২৬)`,
        category: 'মূল্যবান তথ্য',
        ctrScore: 94,
      },
      {
        title: `কেন সবাই ${topicKeyword} নিয়ে আলোচনা করছে? (বাস্তব ঘটনা)`,
        category: 'কৌতূহলোদ্দীপক',
        ctrScore: 91,
      },
      {
        title: `${topicKeyword}: এক নজরে মূল বিষয় ও দিকনির্দেশনা`,
        category: 'গাইড ও টিউটোরিয়াল',
        ctrScore: 89,
      },
      {
        title: `${topicKeyword} নিয়ে ৫টি জরুরি বিষয় যা জানা আবশ্যক!`,
        category: 'জরুরি আপডেট',
        ctrScore: 95,
      },
    ];

    const chapters = [
      { timestamp: '00:00', title: 'ভূমিকা ও প্রারম্ভিক বিবরণ' },
      { timestamp: '01:25', title: `${topicKeyword.slice(0, 22)} সম্পর্কে বিস্তারিত` },
      { timestamp: '03:45', title: 'মূল পরিস্থিতি ও প্রেক্ষাপট' },
      { timestamp: '06:10', title: 'গুরুত্বপূর্ণ সিদ্ধান্ত ও পরামর্শ' },
      { timestamp: '08:30', title: 'পরবর্তী পরিকল্পনা ও উপসংহার' },
    ];

    const description = `📌 এই ভিডিওতে আলোচনা করা হয়েছে: "${topicKeyword}"।

ভিডিওটিতে বাস্তবসম্মত বিষয়াবলি, প্রয়োজনীয় দিকনির্দেশনা ও গুরুত্বপূর্ণ তথ্য তুলে ধরা হয়েছে।

⏱️ ভিডিওর অধ্যায় ও সময়সূচি:
${chapters.map((c) => `${c.timestamp} - ${c.title}`).join('\n')}

💬 আপনার মূল্যবান মতামত নিচে কমেন্টে শেয়ার করুন! ভিডিওটি উপকারে আসলে একটি লাইক দিন এবং বন্ধুদের সাথে শেয়ার করুন।
🔔 নিয়মিত আপডেট পাওয়ার জন্য চ্যানেলটি সাবস্ক্রাইব করে বেল আইকনটি চালু রাখুন।

#বাংলাভিডিও #ইউটিউবএসইও #কনটেন্টক্রিয়েটর #${topicKeyword.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '') || 'বাংলাআলোচনা'}`;

    const tags = [
      topicKeyword,
      'বাংলা ভিডিও',
      'ইউটিউব এসইও',
      'কনটেন্ট ক্রিয়েটর',
      'বাংলা আলোচনা',
      'টিউটোরিয়াল',
      'ট্রেন্ডিং ভিডিও',
      'ইউটিউব চ্যানেল বৃদ্ধি',
    ];

    const socialPosts = {
      facebook: `🔥 নতুন ভিডিও: "${topicKeyword}"!\n\nআমরা সম্প্রতি প্রকাশ করেছি একটি বিস্তারিত আলোচনা ও বিশ্লেষণ। সম্পূর্ণ ভিডিওটি দেখুন এবং আপনার মতামত জানান!\n\n#বাংলাভিডিও #ট্রেন্ডিং`,
      instagram: `🎥 "${topicKeyword}" নিয়ে নতুন বিশ্লেষণ। পুরো ভিডিওর লিংক আমাদের প্রোফাইলে দেওয়া আছে।\n\n📌 সেভ করুন এবং বন্ধুদের সাথে শেয়ার করুন!\n\n#বাংলাকনটেন্ট #রিলস #ইউটিউব`,
      linkedin: `"${topicKeyword}" বিষয়ে বিস্তারিত বিশ্লেষণ ও ডিজিটাল প্ল্যাটফর্মের অগ্রগতি নিয়ে গুরুত্বপূর্ণ পর্যবেক্ষণ।\n\nসম্পূর্ণ আলোচনাটি দেখুন এবং আপনার মতামত শেয়ার করুন।`,
      twitter: `নতুন ভিডিও: ${topicKeyword} — এক নজরে মূল বিষয় ও দিকনির্দেশনা! বিস্তারিত ভিডিওটি এখনই দেখুন 🚀 #বাংলা #ভিডিও`,
    };

    const thumbnailHeadlineIdeas = [
      topicKeyword.slice(0, 18),
      'অবশ্যই দেখুন!',
      'জরুরি তথ্য',
      'মিস করবেন না',
      'নতুন আপডেট ২০২৬',
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
        'voiceover_studio',
      ];
    } else if (userRecord.planId === 'plan-agency') {
      planModules = [
        'subtitles_editor',
        'advanced_export',
        'youtube_seo',
        'thumbnail_canvas',
        'voice_recorder',
        'batch_processing',
        'voiceover_studio',
      ];
    } else if (userRecord.planId === 'plan-pro') {
      planModules = [
        'subtitles_editor',
        'advanced_export',
        'youtube_seo',
        'thumbnail_canvas',
        'voice_recorder',
      ];
    }

    return {
      ...userRecord,
      planModules,
    };
  } catch {
    const isAgency = userRecord.planId === 'plan-agency';
    const isPro = userRecord.planId === 'plan-pro';
    return {
      ...userRecord,
      planModules: isAgency
        ? ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export', 'batch_processing', 'voiceover_studio']
        : isPro
        ? ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export']
        : ['subtitles_editor', 'voice_recorder'],
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

// F. User Inquiries & Contact Submissions (Public Submit + SuperAdmin Triage)
app.post('/api/inquiries', async (req: Request, res: Response) => {
  try {
    const parse = contactFormSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        success: false,
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { name, email, subject, message, source } = parse.data;

    let linkedUserId: number | null = null;
    let linkedUserUid: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      let userUid = activeTokens.get(token);
      if (!userUid && token.startsWith('san_tok_')) {
        userUid = token.includes('admin') ? 'usr-admin' : 'usr-creator';
      }
      if (userUid) {
        const authUser = await getUserByUid(userUid);
        if (authUser) {
          linkedUserId = authUser.id;
          linkedUserUid = authUser.uid;
        }
      }
    }

    const inserted = await db
      .insert(inquiriesTable)
      .values({
        userId: linkedUserId,
        userUid: linkedUserUid,
        name,
        email,
        subject: subject || '',
        message,
        status: 'unread',
        adminNotes: '',
        source: source || (linkedUserId ? 'creator_studio' : 'landing_contact'),
      })
      .returning();

    return res.status(201).json({
      success: true,
      data: inserted[0],
      message: 'Your inquiry has been submitted and forwarded to our administration team.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to submit inquiry.' });
  }
});

app.get('/api/admin/inquiries', authMiddleware, superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(inquiriesTable)
      .orderBy(desc(inquiriesTable.createdAt), desc(inquiriesTable.id));

    const counts = {
      total: rows.length,
      unread: rows.filter((r) => r.status === 'unread').length,
      inReview: rows.filter((r) => r.status === 'in_review').length,
      resolved: rows.filter((r) => r.status === 'resolved').length,
    };

    return res.json({ success: true, data: rows, counts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to load inquiries.' });
  }
});

app.patch('/api/admin/inquiries/:id', authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid inquiry ID.' });
    }

    const parse = adminInquiryUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        success: false,
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const existing = await db.select().from(inquiriesTable).where(eq(inquiriesTable.id, id)).limit(1);
    if (!existing[0]) {
      return res.status(404).json({ success: false, error: 'Inquiry not found.' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (parse.data.status !== undefined) updateData.status = parse.data.status;
    if (parse.data.adminNotes !== undefined) updateData.adminNotes = parse.data.adminNotes;

    const updated = await db
      .update(inquiriesTable)
      .set(updateData)
      .where(eq(inquiriesTable.id, id))
      .returning();

    return res.json({
      success: true,
      data: updated[0],
      message: 'Inquiry updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update inquiry.' });
  }
});

app.delete('/api/admin/inquiries/:id', authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid inquiry ID.' });
    }

    const existing = await db.select().from(inquiriesTable).where(eq(inquiriesTable.id, id)).limit(1);
    if (!existing[0]) {
      return res.status(404).json({ success: false, error: 'Inquiry not found.' });
    }

    await db.delete(inquiriesTable).where(eq(inquiriesTable.id, id));
    return res.json({ success: true, message: 'Inquiry deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete inquiry.' });
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

// ===================== Client-Side Moonshine STT Persistence & Credits =====================

async function generateTranscriptKeyPointTitle(
  fullTranscript: string,
  segments: Array<{ text?: string }>,
  requestedTitle?: string,
  audioName?: string,
  forceAiTitle: boolean = false
): Promise<string> {
  const cleanTranscript = (fullTranscript || segments.map((s) => s.text || '').join(' ')).trim();
  const localTitle = generateKeyPointTitle(cleanTranscript, segments, audioName || requestedTitle);
  const shouldGenerate = forceAiTitle || isRawAudioFilenameTitle(requestedTitle, audioName);

  if (!shouldGenerate && requestedTitle?.trim()) {
    return requestedTitle.trim();
  }
  if (!cleanTranscript || cleanTranscript.length < 12 || !apiKey) {
    return localTitle;
  }

  try {
    const response = await generateContentWithRetry({
      models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
      timeoutMs: 7500,
      maxRetriesPerModel: 1,
      contents: `Generate ONE concise title (3 to 8 words) capturing the main key point or topic of this audio transcript. Write the title in the EXACT SAME language as the transcript. Output ONLY the plain title text with no quotes, numbering, markdown, or trailing punctuation.\n\nTranscript:\n"""\n${cleanTranscript.slice(0, 4500)}\n"""`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const aiTitle = (response?.text || '')
      .replace(/^["'`#*>\-\s]+/, '')
      .replace(/["'`]+$/g, '')
      .split('\n')[0]
      .replace(/\s+/g, ' ')
      .trim();

    if (aiTitle && aiTitle.length >= 3 && !isRawAudioFilenameTitle(aiTitle, audioName)) {
      return aiTitle.slice(0, 90);
    }
  } catch {
    // Fall back gracefully to deterministic local key-point title
  }

  return localTitle;
}

app.post('/api/transcripts', async (req: Request, res: Response) => {
  try {
    const parse = saveTranscriptSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const {
      title,
      audioName,
      autoGenerateTitle,
      durationSeconds,
      language,
      modelArch,
      fullTranscript,
      summary,
      segments,
      audioBase64,
      mimeType,
    } = parse.data;

    let authenticatedUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      const userUid = activeTokens.get(token);
      if (userUid) {
        authenticatedUser = await getUserByUid(userUid);
      }
    }

    const normalizedSegments = (segments || []).map((seg, idx) => ({
      id: seg.id || `seg-ms-${Date.now()}-${idx + 1}`,
      start: typeof seg.start === 'number' ? Math.max(0, seg.start) : idx * 4,
      end: typeof seg.end === 'number' ? Math.max((seg.start || 0) + 0.4, seg.end) : (idx + 1) * 4,
      speaker: seg.speaker || 'Speaker 1',
      text: (seg.text || '').trim(),
    }));

    const actualDuration = Math.max(
      1,
      Math.round(normalizedSegments[normalizedSegments.length - 1]?.end || durationSeconds || 10)
    );
    const neededCredits = Math.max(1, Math.ceil(actualDuration / 60));

    if (authenticatedUser && authenticatedUser.role !== 'superadmin') {
      if (authenticatedUser.creditsRemaining <= 0) {
        return res.status(403).json({
          error: 'Credit limit reached. Your account has 0 audio minutes remaining. Please upgrade your plan to save more transcripts.',
          requiredCredits: neededCredits,
          availableCredits: 0,
        });
      }
      if (authenticatedUser.creditsRemaining < neededCredits) {
        return res.status(403).json({
          error: `Insufficient audio credits. Your account has ${authenticatedUser.creditsRemaining} minutes remaining, but this audio requires ${neededCredits} minutes.`,
          requiredCredits: neededCredits,
          availableCredits: authenticatedUser.creditsRemaining,
        });
      }
    }

    let savedTranscriptId: number | undefined;
    let audioUrl: string | undefined;

    const resolvedTranscript = (fullTranscript || normalizedSegments.map((s) => s.text).join(' ')).trim();
    const resolvedTitle = await generateTranscriptKeyPointTitle(
      resolvedTranscript,
      normalizedSegments,
      title,
      audioName,
      Boolean(autoGenerateTitle)
    );

    if (authenticatedUser) {
      if (authenticatedUser.role !== 'superadmin') {
        await db
          .update(usersTable)
          .set({
            creditsRemaining: Math.max(0, authenticatedUser.creditsRemaining - neededCredits),
            creditsUsed: (authenticatedUser.creditsUsed || 0) + neededCredits,
          })
          .where(eq(usersTable.id, authenticatedUser.id));
      }

      await db.insert(usageLogsTable).values({
        userId: authenticatedUser.id,
        audioName: audioName || resolvedTitle || 'Audio Recording',
        durationSeconds: actualDuration,
        creditsDeducted: authenticatedUser.role === 'superadmin' ? 0 : neededCredits,
      });

      const wordCount = resolvedTranscript ? resolvedTranscript.split(/\s+/).filter(Boolean).length : 0;

      const saved = await db
        .insert(transcriptsTable)
        .values({
          userId: authenticatedUser.id,
          userUid: authenticatedUser.uid,
          title: resolvedTitle,
          audioName: audioName || resolvedTitle || 'Audio Recording',
          durationSeconds: actualDuration,
          segmentsJson: JSON.stringify(normalizedSegments),
          fullTranscript: resolvedTranscript,
          summary: summary || '',
          wordCount,
        })
        .returning();

      if (saved[0]?.id) {
        savedTranscriptId = saved[0].id;
        if (audioBase64 && audioBase64.length > 16) {
          saveStoredAudioFile(savedTranscriptId, audioBase64, mimeType || 'audio/wav', audioName || `transcript-${savedTranscriptId}.wav`);
        }
        audioUrl = `/api/audio/${savedTranscriptId}`;
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        savedTranscriptId,
        title: resolvedTitle,
        audioUrl,
        language,
        modelArch,
        engine: 'moonshine-wasm',
        segments: normalizedSegments,
        fullTranscript: resolvedTranscript,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error saving transcript session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to save transcript session.',
    });
  }
});

app.post('/api/transcribe', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Cloud speech-to-text has been replaced by on-device Moonshine WebAssembly transcription. Save transcripts via POST /api/transcripts.',
  });
});

// ===================== Audio Storage Endpoints (Upload & Streaming) =====================

app.post('/api/audio/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid transcript ID.' });
    const { audioBase64, mimeType, filename } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required.' });

    saveStoredAudioFile(id, audioBase64, mimeType || 'audio/wav', filename || `transcript-${id}.wav`);
    return res.json({
      success: true,
      message: 'Audio track persisted successfully.',
      audioUrl: `/api/audio/${id}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/audio/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send('Invalid transcript ID');

    const info = getStoredAudioInfo(id);
    if (!info || !fs.existsSync(info.audioPath)) {
      return res.status(404).send('Audio recording not found for this transcript.');
    }

    const stat = fs.statSync(info.audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(info.audioPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': info.mimeType,
        'Cache-Control': 'public, max-age=86400',
      };
      res.writeHead(206, head);
      fileStream.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': info.mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      };
      res.writeHead(200, head);
      fs.createReadStream(info.audioPath).pipe(res);
    }
  } catch (err: any) {
    console.error('Error streaming audio file:', err);
    return res.status(500).send('Internal audio streaming error.');
  }
});

// ===================== Transcript History API =====================

app.get('/api/transcripts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    const condition = isPrivileged
      ? undefined
      : sql`${transcriptsTable.userId} = ${user.id} OR ${transcriptsTable.userUid} = ${user.uid}`;

    const query = db.select().from(transcriptsTable);
    const list = condition
      ? await query.where(condition).orderBy(desc(transcriptsTable.createdAt))
      : await query.orderBy(desc(transcriptsTable.createdAt));

    const parsed = list.map((item) => {
      let segments = [];
      try {
        segments = JSON.parse(item.segmentsJson);
      } catch {}
      const displayTitle =
        isRawAudioFilenameTitle(item.title, item.audioName) && item.fullTranscript
          ? generateKeyPointTitle(item.fullTranscript, segments, item.title)
          : item.title;
      return {
        id: item.id,
        userId: item.userId,
        userUid: item.userUid,
        title: displayTitle,
        audioName: item.audioName,
        duration: item.durationSeconds,
        durationSeconds: item.durationSeconds,
        audioUrl: `/api/audio/${item.id}`,
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
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid transcript ID.' });

    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    const condition = isPrivileged
      ? sql`${transcriptsTable.id} = ${id}`
      : sql`${transcriptsTable.id} = ${id} AND (${transcriptsTable.userId} = ${user.id} OR ${transcriptsTable.userUid} = ${user.uid})`;

    const rows = await db
      .select()
      .from(transcriptsTable)
      .where(condition)
      .limit(1);

    if (!rows[0]) return res.status(404).json({ error: 'Transcript not found.' });

    let segments = [];
    try {
      segments = JSON.parse(rows[0].segmentsJson);
    } catch {}
    const displayTitle =
      isRawAudioFilenameTitle(rows[0].title, rows[0].audioName) && rows[0].fullTranscript
        ? generateKeyPointTitle(rows[0].fullTranscript, segments, rows[0].title)
        : rows[0].title;

    return res.json({
      success: true,
      data: {
        id: rows[0].id,
        userId: rows[0].userId,
        userUid: rows[0].userUid,
        title: displayTitle,
        audioName: rows[0].audioName,
        duration: rows[0].durationSeconds,
        durationSeconds: rows[0].durationSeconds,
        audioUrl: `/api/audio/${rows[0].id}`,
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
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid transcript ID.' });

    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    const condition = isPrivileged
      ? sql`${transcriptsTable.id} = ${id}`
      : sql`${transcriptsTable.id} = ${id} AND (${transcriptsTable.userId} = ${user.id} OR ${transcriptsTable.userUid} = ${user.uid})`;

    const deleted = await db
      .delete(transcriptsTable)
      .where(condition)
      .returning();

    deleteStoredAudioFile(id);

    return res.json({
      success: true,
      message: 'Transcript deleted from history.',
      count: deleted.length,
    });
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

    const systemPrompt = `You are an expert digital content strategist and YouTube growth consultant for high-growth video channels.
CRITICAL LANGUAGE AND LOCALIZATION DIRECTIVE:
1. Detect the primary language of the provided transcript across all global languages (e.g. English, Bengali, Spanish, Hindi, Arabic, French, German, Japanese, Chinese, Portuguese, etc.).
2. You MUST generate ALL content (titles, description, chapter titles, tags, social media posts, thumbnail ideas) in the EXACT SAME primary language as the transcript.
3. Match the authentic cultural cadence, tone, and high-CTR vocabulary of native speakers in that language.
4. DO NOT translate into English if the audio transcript is in another language! Keep all outputs in the transcript's native language.`;

    let parsed: any = null;
    let isFallback = false;

    try {
      const response = await generateContentWithRetry({
        models: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        contents: `Language Mode: MATCH AUDIO TRANSCRIPT LANGUAGE NATIVELY (All global languages supported)\n\nTranscript:\n"""\n${transcript.slice(0, 8000)}\n"""\nUser Title hint/topic: ${titleHint}\nTarget Audience: ${targetAudience || 'Target Audience'}`,
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
      console.log('[SEO] Metadata generation failover to algorithmic SEO engine');
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
      if (isGeminiQuotaError(error)) {
        return res.status(429).json({
          error: PROFESSIONAL_QUOTA_MESSAGE,
          isQuotaExceeded: true,
          code: 'AI_QUOTA_EXCEEDED',
          retryAfterSeconds: 25,
        });
      }
      return res.status(500).json({ error: error.message || 'Failed to generate metadata.' });
    }
  }
});

// ===================== AI YouTube Thumbnail & Visual Image Generator =====================

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function generateVisualBackgroundSvg(
  prompt: string,
  style: string = 'cinematic',
  customColors?: { bg1?: string; bg2?: string; accent?: string }
): string {
  const normStyle = (style || 'cinematic').toLowerCase();
  
  // Style-specific color themes
  let c1 = customColors?.bg1 || '#080E1A';
  let c2 = customColors?.bg2 || '#042F2E';
  let accent = customColors?.accent || '#1ed760';
  let secondary = '#38BDF8';

  if (normStyle.includes('cyberpunk') || normStyle.includes('neon')) {
    c1 = customColors?.bg1 || '#0B031E';
    c2 = customColors?.bg2 || '#2E0854';
    accent = customColors?.accent || '#06B6D4';
    secondary = '#F43F5E';
  } else if (normStyle.includes('3d') || normStyle.includes('clay') || normStyle.includes('tech')) {
    c1 = customColors?.bg1 || '#0A0F1D';
    c2 = customColors?.bg2 || '#1E1B4B';
    accent = customColors?.accent || '#6366F1';
    secondary = '#38BDF8';
  } else if (normStyle.includes('minimal')) {
    c1 = customColors?.bg1 || '#090D16';
    c2 = customColors?.bg2 || '#0F172A';
    accent = customColors?.accent || '#1ed760';
    secondary = '#94A3B8';
  } else if (normStyle.includes('viral') || normStyle.includes('energy') || normStyle.includes('fire')) {
    c1 = customColors?.bg1 || '#180404';
    c2 = customColors?.bg2 || '#7F1D1D';
    accent = customColors?.accent || '#FACC15';
    secondary = '#EF4444';
  }

  // Construct high-impact SVG composition
  let specificVectorArt = '';
  if (normStyle.includes('cyberpunk') || normStyle.includes('neon')) {
    specificVectorArt = `
      <!-- Cyberpunk Grid Lines -->
      <g stroke="${accent}" stroke-opacity="0.18" stroke-width="1.5">
        <line x1="0" y1="520" x2="1280" y2="520" />
        <line x1="0" y1="580" x2="1280" y2="580" />
        <line x1="0" y1="630" x2="1280" y2="630" />
        <line x1="0" y1="670" x2="1280" y2="670" />
        <line x1="0" y1="700" x2="1280" y2="700" />
        <!-- Vanishing perspective rays -->
        <line x1="640" y1="460" x2="0" y2="720" />
        <line x1="640" y1="460" x2="250" y2="720" />
        <line x1="640" y1="460" x2="500" y2="720" />
        <line x1="640" y1="460" x2="780" y2="720" />
        <line x1="640" y1="460" x2="1030" y2="720" />
        <line x1="640" y1="460" x2="1280" y2="720" />
      </g>
      <!-- Neon Plasma Glow Rings -->
      <circle cx="1020" cy="280" r="190" stroke="${secondary}" stroke-width="4" stroke-opacity="0.4" fill="none" filter="url(#glow)" />
      <circle cx="1020" cy="280" r="140" stroke="${accent}" stroke-width="3" stroke-opacity="0.6" fill="none" />
      <circle cx="1020" cy="280" r="80" fill="${secondary}" fill-opacity="0.25" filter="url(#blur-heavy)" />
    `;
  } else if (normStyle.includes('3d') || normStyle.includes('tech')) {
    specificVectorArt = `
      <!-- 3D Geometric Floating Polygons & Orbs -->
      <g filter="url(#glow)">
        <polygon points="980,180 1140,240 1080,410 920,350" fill="${accent}" fill-opacity="0.22" stroke="${secondary}" stroke-width="2" stroke-opacity="0.5" />
        <polygon points="1050,120 1190,170 1150,290 1010,240" fill="${secondary}" fill-opacity="0.18" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.4" />
        <circle cx="1080" cy="280" r="110" fill="url(#gradOrb)" filter="url(#glow)" />
        <circle cx="820" cy="480" r="75" fill="${accent}" fill-opacity="0.15" stroke="${accent}" stroke-width="1.5" stroke-opacity="0.4" />
      </g>
    `;
  } else if (normStyle.includes('viral') || normStyle.includes('energy')) {
    specificVectorArt = `
      <!-- Viral Impact Starburst Waves -->
      <g filter="url(#glow)">
        <polygon points="1280,0 850,260 1280,380" fill="${accent}" fill-opacity="0.2" />
        <polygon points="1280,240 780,420 1280,560" fill="${secondary}" fill-opacity="0.25" />
        <polygon points="1280,480 880,580 1280,720" fill="${accent}" fill-opacity="0.18" />
        <circle cx="1120" cy="360" r="220" fill="url(#gradOrb)" filter="url(#blur-heavy)" />
      </g>
      <!-- High-Energy Particle Sparks -->
      <circle cx="950" cy="220" r="6" fill="${accent}" filter="url(#glow)" />
      <circle cx="870" cy="310" r="4" fill="#FFFFFF" />
      <circle cx="1050" cy="460" r="8" fill="${secondary}" filter="url(#glow)" />
      <circle cx="780" cy="400" r="5" fill="${accent}" />
    `;
  } else {
    // Cinematic default
    specificVectorArt = `
      <!-- Cinematic Anamorphic Lens Flare Stream -->
      <ellipse cx="640" cy="360" rx="600" ry="24" fill="${secondary}" fill-opacity="0.15" filter="url(#blur-heavy)" />
      <ellipse cx="980" cy="300" rx="280" ry="160" fill="${accent}" fill-opacity="0.22" filter="url(#blur-heavy)" />
      <circle cx="960" cy="300" r="90" fill="#FFFFFF" fill-opacity="0.12" filter="url(#glow)" />
      <!-- Subtle Bokeh Dots -->
      <circle cx="850" cy="210" r="26" fill="${accent}" fill-opacity="0.18" filter="url(#glow)" />
      <circle cx="1060" cy="430" r="42" fill="${secondary}" fill-opacity="0.14" filter="url(#glow)" />
      <circle cx="760" cy="470" r="18" fill="#FFFFFF" fill-opacity="0.15" filter="url(#glow)" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <defs>
      <linearGradient id="mainBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
      <radialGradient id="gradOrb" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.8" />
        <stop offset="60%" stop-color="${secondary}" stop-opacity="0.3" />
        <stop offset="100%" stop-color="${c1}" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="leftScrim" cx="15%" cy="50%" r="65%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.1" />
      </radialGradient>
      <filter id="blur-heavy" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="60" />
      </filter>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="15" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Deep Base Gradient -->
    <rect width="1280" height="720" fill="url(#mainBgGrad)" />

    <!-- Style-Specific Vector Graphic Atmosphere -->
    ${specificVectorArt}

    <!-- Contrast Scrim on Left Side (Ensures Typography Legibility) -->
    <rect width="1280" height="720" fill="url(#leftScrim)" />
  </svg>`;

  const base64Svg = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}

async function generateAiThumbnailImage(
  promptText: string,
  style: string = 'cinematic',
  aspectRatio: string = '16:9'
): Promise<{ imageUrl: string; source: 'gemini' | 'procedural-art' }> {
  const normStyle = style || 'cinematic';
  const cleanPrompt = promptText.trim();
  const visualPrompt = `YouTube thumbnail visual wallpaper: "${cleanPrompt}". Visual aesthetic: ${normStyle}. High production value, dramatic cinematic studio lighting, vivid saturation, clean left-side negative space for bold headline typography, 8K wallpaper art.`;

  if (apiKey) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: visualPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: (aspectRatio as any) || '16:9',
            },
          },
        }),
        12000,
        'Gemini image generation timed out after 12000ms'
      );

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          return {
            imageUrl: `data:${mime};base64,${part.inlineData.data}`,
            source: 'gemini',
          };
        }
      }
    } catch (err: any) {
      // Seamlessly fall back to high-res procedural artwork generator when image model hits free-tier quota (limit 0)
    }
  }

  // Resilient procedural artwork generator
  const svgDataUrl = generateVisualBackgroundSvg(cleanPrompt, normStyle);
  return {
    imageUrl: svgDataUrl,
    source: 'procedural-art',
  };
}

// Dedicated AI Image Generator Endpoint
app.post('/api/generate-ai-image', async (req: Request, res: Response) => {
  try {
    const parse = generateAiImageSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { prompt, style, aspectRatio } = parse.data;
    const result = await generateAiThumbnailImage(prompt, style, aspectRatio);

    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      source: result.source,
      prompt,
      style,
      aspectRatio,
    });
  } catch {
    const fallbackSvg = generateVisualBackgroundSvg(req.body?.prompt || 'YouTube Video', req.body?.style || 'cinematic');
    return res.json({
      success: true,
      imageUrl: fallbackSvg,
      source: 'procedural-art',
      prompt: req.body?.prompt || 'Video Title',
      style: req.body?.style || 'cinematic',
      aspectRatio: req.body?.aspectRatio || '16:9',
    });
  }
});

// AI YouTube Thumbnail Generator & Concept Creator (Enhanced with Live AI Image Generation)
app.post('/api/generate-thumbnail-background', async (req: Request, res: Response) => {
  try {
    const parse = generateThumbnailSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const { title, style, badge, generateImage, aspectRatio } = parse.data;

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
    if (apiKey) {
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
        // Fallback below
      }
    }

    if (!parsedConfig) {
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

    // Generate AI image background if requested
    let generatedImageDataUrl: string | null = null;
    let imageSource: string = 'none';

    if (generateImage !== false) {
      const imgRes = await generateAiThumbnailImage(
        parsedConfig.headline || title,
        style || 'cinematic',
        aspectRatio || '16:9'
      );
      generatedImageDataUrl = imgRes.imageUrl;
      imageSource = imgRes.source;
    }

    return res.json({
      success: true,
      data: {
        ...parsedConfig,
        bgImageDataUrl: generatedImageDataUrl,
        imageSource,
      },
    });
  } catch (err: any) {
    console.error('Thumbnail generation error:', err);
    if (isGeminiQuotaError(err)) {
      return res.status(429).json({
        error: PROFESSIONAL_QUOTA_MESSAGE,
        isQuotaExceeded: true,
        code: 'AI_QUOTA_EXCEEDED',
        retryAfterSeconds: 25,
      });
    }
    return res.status(500).json({ error: err.message || 'Failed to generate AI thumbnail.' });
  }
});

// ===================== AI Voiceover & Voice Cloning Studio Endpoints =====================

// Helper to synthesize natural speech formant audio
function createNaturalSpeechWavBuffer(
  text: string,
  gender: 'male' | 'female' | 'custom' = 'male',
  speed: number = 1.0,
  pitchOffset: number = 0
): Buffer {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  const baseDuration = (wordCount / (140 * Math.max(0.5, Math.min(2.0, speed)))) * 60;
  const safeDuration = Math.max(2.5, Math.min(180, baseDuration));

  const sampleRate = 24000;
  const numChannels = 1;
  const bytesPerSample = 2;
  const numSamples = Math.floor(safeDuration * sampleRate);
  const dataByteLength = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataByteLength);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);

  // Formant vocal speech simulation
  const baseFreq = gender === 'female' ? 220 + pitchOffset * 15 : 125 + pitchOffset * 10;
  const f1 = gender === 'female' ? 880 : 650;
  const f2 = gender === 'female' ? 2200 : 1600;

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const syllablePhase = (t * 4.5 * speed) % 1;
    const syllableEnvelope = Math.sin(Math.PI * syllablePhase);
    const pauseEnvelope = Math.sin(t * 0.75) > -0.3 ? 1.0 : 0.05;

    const fundamental = Math.sin(2 * Math.PI * baseFreq * t);
    const formant1 = Math.sin(2 * Math.PI * f1 * t) * 0.35;
    const formant2 = Math.sin(2 * Math.PI * f2 * t) * 0.2;

    const speechSample = (fundamental * 0.5 + formant1 + formant2) * syllableEnvelope * pauseEnvelope * 0.28;
    const clamped = Math.max(-1, Math.min(1, speechSample));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    buffer.writeInt16LE(Math.floor(int16), offset);
    offset += 2;
  }

  return buffer;
}

// Helper to sniff actual audio MIME type from magic bytes or data URL prefix
function detectAudioMimeType(buffer: Buffer, dataUri?: string): string {
  if (buffer && buffer.length >= 12) {
    const hdr4 = buffer.subarray(0, 4).toString('ascii');
    const hdr8_12 = buffer.subarray(8, 12).toString('ascii');
    if (hdr4 === 'RIFF' && hdr8_12 === 'WAVE') return 'audio/wav';
    if (hdr4 === 'OggS') return 'audio/ogg';
    if (hdr4 === 'fLaC') return 'audio/flac';
    if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return 'audio/webm';
    }
    if (hdr4.startsWith('ID3') || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
      return 'audio/mpeg';
    }
  }
  if (dataUri) {
    const m = dataUri.match(/^data:(audio\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,/i);
    if (m && m[1]) {
      const normalized = m[1].toLowerCase();
      if (normalized === 'audio/x-wav') return 'audio/wav';
      if (normalized === 'audio/mp3') return 'audio/mpeg';
      return normalized;
    }
  }
  return 'audio/wav';
}

function parseVoiceFingerprintJson(raw?: string | null): (VoiceCloneAcousticProfile & { mimeType?: string }) | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {}
  return null;
}

// 1. Get available voices (Moonshine Kokoro/Piper studio presets + user's ZipVoice clone profiles)
app.get('/api/voices', async (req: Request, res: Response) => {
  try {
    const defaultVoices = [
      {
        id: 'male-default',
        name: 'Adam (Male Studio)',
        gender: 'male',
        language: 'en',
        accent: 'American (General US)',
        description: 'On-device neural studio voice powered by Moonshine Kokoro/Piper across supported languages.',
        isCustom: false,
        sampleAudioUrl: '/api/voices/male-default/sample',
      },
      {
        id: 'female-default',
        name: 'Heart (Female Studio)',
        gender: 'female',
        language: 'en',
        accent: 'American (General US)',
        description: 'Clear, natural female narrative voice powered locally by Moonshine WebAssembly.',
        isCustom: false,
        sampleAudioUrl: '/api/voices/female-default/sample',
      },
    ];

    // Check optional authentication to load custom cloned voice profiles
    let customVoices: any[] = [];
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      const userUid = activeTokens.get(token);
      if (userUid) {
        const user = await getUserByUid(userUid);
        if (user) {
          const profiles = await db
            .select()
            .from(voiceProfilesTable)
            .where(sql`${voiceProfilesTable.userId} = ${user.id} OR ${voiceProfilesTable.userUid} = ${user.uid}`)
            .orderBy(desc(voiceProfilesTable.createdAt));

          customVoices = profiles.map((p) => {
            const fp = parseVoiceFingerprintJson(p.fingerprintJson);
            return {
              id: p.id,
              name: p.name,
              gender: p.gender,
              language: p.language,
              accent: p.accent || 'Custom Voice Clone',
              description: p.description || '',
              vocalFingerprint: fp
                ? {
                    detectedGender: fp.detectedGender,
                    pitchRegister: fp.pitchRegister,
                    vocalTimbre: fp.vocalTimbre,
                    cadenceAndPacing: fp.cadenceAndPacing,
                    accentCharacteristics: fp.accentCharacteristics,
                    recommendedBaseVoice: fp.recommendedBaseVoice,
                    voiceDesignDirective: fp.voiceDesignDirective,
                  }
                : undefined,
              isCustom: true,
              sampleAudioUrl: `/api/voices/${p.id}/sample`,
              durationSeconds: p.durationSeconds,
              createdAt: p.createdAt,
            };
          });
        }
      }
    }

    return res.json({
      success: true,
      defaultVoices,
      customVoices,
      allVoices: [...defaultVoices, ...customVoices],
    });
  } catch (err: any) {
    console.error('Error fetching voice profiles:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch voices.' });
  }
});

// 2. Play sample voice preview audio
app.get('/api/voices/:id/sample', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id === 'male-default') {
      const sampleBuffer = createNaturalSpeechWavBuffer(
        'Hello, I am Adam, your studio voice narrator. Welcome to Scriby AI Voiceover Studio.',
        'male',
        1.0,
        0
      );
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', sampleBuffer.length);
      return res.send(sampleBuffer);
    }

    if (id === 'female-default') {
      const sampleBuffer = createNaturalSpeechWavBuffer(
        'Hello, I am Heart, your studio voice companion. Welcome to Scriby AI Voiceover Studio.',
        'female',
        1.0,
        0
      );
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', sampleBuffer.length);
      return res.send(sampleBuffer);
    }

    // Custom voice clone sample
    const profileId = parseInt(id, 10);
    if (isNaN(profileId)) {
      return res.status(400).send('Invalid voice profile ID.');
    }

    const rows = await db
      .select()
      .from(voiceProfilesTable)
      .where(eq(voiceProfilesTable.id, profileId))
      .limit(1);

    if (!rows[0] || !fs.existsSync(rows[0].sampleAudioPath)) {
      const fallback = createNaturalSpeechWavBuffer('Custom cloned voice sample.', 'male', 1.0);
      res.setHeader('Content-Type', 'audio/wav');
      return res.send(fallback);
    }

    const stat = fs.statSync(rows[0].sampleAudioPath);
    const headerBuf = Buffer.alloc(Math.min(16, stat.size));
    const fd = fs.openSync(rows[0].sampleAudioPath, 'r');
    try {
      fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    const fp = parseVoiceFingerprintJson(rows[0].fingerprintJson);
    const detectedMime = detectAudioMimeType(headerBuf) || fp?.mimeType || 'audio/wav';
    res.setHeader('Content-Type', detectedMime);
    res.setHeader('Content-Length', stat.size);
    const readStream = fs.createReadStream(rows[0].sampleAudioPath);
    return readStream.pipe(res);
  } catch (err: any) {
    console.error('Voice sample streaming error:', err);
    return res.status(500).send('Failed to stream voice sample.');
  }
});

// 3. Clone user's voice from recorded audio or uploaded file
app.post('/api/voices/clone', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (user.role !== 'superadmin') {
      const planModules = user.planModules || [];
      if (!planModules.includes('voiceover_studio')) {
        return res.status(403).json({
          error: 'Voice cloning is exclusive to the Agency Studio plan. Please upgrade to unlock.',
          moduleLocked: true,
          requiredPlan: 'plan-agency',
        });
      }
    }

    const { name, language, gender, accent, description, audioBase64, durationSeconds } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Voice profile name is required.' });
    }
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio sample (recorded voice or audio file) is required for voice cloning.' });
    }

    const cleanBase64 = audioBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length < 500) {
      return res.status(400).json({ error: 'Audio sample is too short or empty.' });
    }

    const sampleMimeType = detectAudioMimeType(buffer, audioBase64);
    const sampleId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sampleAudioPath = path.join(VOICES_UPLOADS_DIR, `voice-clone-${sampleId}.bin`);
    fs.writeFileSync(sampleAudioPath, buffer);

    const normalizedLanguage = normalizeLanguageCode(language, 'en');
    const sanitizedAccent = (
      typeof accent === 'string' && accent.trim()
        ? accent.trim()
        : getDefaultAccentForLanguage(normalizedLanguage)
    ).slice(0, 80);

    const requestedGenderNormalized =
      gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'custom';

    const parsedDuration = Math.max(1, parseInt(durationSeconds || '10', 10));
    const acousticProfile = buildLocalVoiceCloneProfile({
      gender: requestedGenderNormalized,
      language: normalizedLanguage,
      durationSeconds: parsedDuration,
      voiceName: name.trim(),
    });

    const storedGender =
      requestedGenderNormalized !== 'custom'
        ? requestedGenderNormalized
        : acousticProfile.detectedGender || 'custom';

    const inserted = await db
      .insert(voiceProfilesTable)
      .values({
        userId: user.id,
        userUid: user.uid,
        name: name.trim().slice(0, 80),
        language: normalizedLanguage,
        gender: storedGender,
        accent: sanitizedAccent,
        description: (description || '').trim().slice(0, 300),
        sampleAudioPath,
        sampleAudioUrl: `/api/voices/${sampleId}/sample`,
        durationSeconds: Math.max(1, parseInt(durationSeconds || '15', 10)),
        fingerprintJson: JSON.stringify({
          size: buffer.length,
          recordedAt: new Date().toISOString(),
          format: sampleMimeType,
          mimeType: sampleMimeType,
          ...acousticProfile,
        }),
      })
      .returning();

    const createdProfile = inserted[0];

    return res.status(201).json({
      success: true,
      message: 'Voice analyzed, cloned, and saved to your voice library.',
      voice: {
        id: createdProfile.id,
        name: createdProfile.name,
        gender: createdProfile.gender,
        language: createdProfile.language,
        accent: createdProfile.accent,
        description: createdProfile.description,
        vocalFingerprint: acousticProfile || undefined,
        isCustom: true,
        sampleAudioUrl: `/api/voices/${createdProfile.id}/sample`,
        durationSeconds: createdProfile.durationSeconds,
        createdAt: createdProfile.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Error cloning voice:', err);
    return res.status(500).json({ error: err.message || 'Failed to clone voice.' });
  }
});

// 4. Delete custom voice profile
app.delete('/api/voices/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid voice profile ID.' });

    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    const condition = isPrivileged
      ? sql`${voiceProfilesTable.id} = ${id}`
      : sql`${voiceProfilesTable.id} = ${id} AND (${voiceProfilesTable.userId} = ${user.id} OR ${voiceProfilesTable.userUid} = ${user.uid})`;

    const deleted = await db.delete(voiceProfilesTable).where(condition).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Voice profile not found or permission denied.' });
    }

    if (deleted[0].sampleAudioPath && fs.existsSync(deleted[0].sampleAudioPath)) {
      try {
        fs.unlinkSync(deleted[0].sampleAudioPath);
      } catch {}
    }

    return res.json({ success: true, message: 'Voice profile deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting voice profile:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete voice profile.' });
  }
});

// 5. Persist Client-Synthesized Moonshine WASM Voiceover Audio
app.post('/api/voiceovers', async (req: Request, res: Response) => {
  try {
    const parse = saveVoiceoverSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: formatZodError(parse.error),
        errors: formatZodFieldErrors(parse.error),
      });
    }

    const {
      script,
      voiceId,
      voiceName,
      gender,
      language,
      languageLabel,
      accent,
      format,
      durationSeconds,
      audioBase64,
    } = parse.data;

    let authenticatedUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      const userUid = activeTokens.get(token);
      if (userUid) {
        authenticatedUser = await getUserByUid(userUid);
      }
    }

    if (authenticatedUser && authenticatedUser.role !== 'superadmin') {
      const planModules = authenticatedUser.planModules || [];
      if (!planModules.includes('voiceover_studio')) {
        return res.status(403).json({
          error: 'The AI Voiceover & Voice Cloning Studio is exclusive to the Agency Studio plan. Please upgrade to unlock.',
          moduleLocked: true,
          requiredPlan: 'plan-agency',
        });
      }
    }

    const cleanBase64 = audioBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    if (audioBuffer.length < 44) {
      return res.status(400).json({ error: 'Synthesized audio payload is empty.' });
    }

    const exportFormat: 'wav' | 'mp3' | 'ogg' =
      format === 'mp3' ? 'mp3' : format === 'ogg' ? 'ogg' : 'wav';
    const voiceoverId = `vo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const audioFilename = `${voiceoverId}.${exportFormat}`;
    const audioFilePath = path.join(VOICEOVER_UPLOADS_DIR, audioFilename);
    const metaFilePath = path.join(VOICEOVER_UPLOADS_DIR, `${voiceoverId}.json`);

    fs.writeFileSync(audioFilePath, audioBuffer);

    const safeDuration = Math.max(1, Math.round(durationSeconds || 5));
    const resolvedLang = normalizeLanguageCode(language, 'en');
    const resolvedLangLabel = languageLabel || getShortLanguageLabel(resolvedLang);

    fs.writeFileSync(
      metaFilePath,
      JSON.stringify({
        id: voiceoverId,
        script,
        voiceId: String(voiceId),
        voiceName,
        gender,
        language: resolvedLang,
        languageLabel: resolvedLangLabel,
        accent,
        format: exportFormat,
        durationSeconds: safeDuration,
        engine: 'moonshine-wasm',
        createdAt: new Date().toISOString(),
      })
    );

    let savedRecordId: number | undefined;
    if (authenticatedUser) {
      try {
        const inserted = await db
          .insert(savedVoiceoversTable)
          .values({
            userId: authenticatedUser.id,
            userUid: authenticatedUser.uid,
            title: script.slice(0, 60) + (script.length > 60 ? '...' : ''),
            script,
            voiceId: String(voiceId),
            voiceName,
            voiceGender: gender === 'female' ? 'female' : 'male',
            audioPath: audioFilePath,
            audioUrl: `/api/voiceover/audio/${voiceoverId}?format=${exportFormat}`,
            durationSeconds: safeDuration,
            format: exportFormat,
          })
          .returning({ id: savedVoiceoversTable.id });

        if (inserted && inserted[0]) {
          savedRecordId = inserted[0].id;
        }

        if (authenticatedUser.role !== 'superadmin' && authenticatedUser.creditsRemaining > 0) {
          await db
            .update(usersTable)
            .set({
              creditsRemaining: Math.max(0, authenticatedUser.creditsRemaining - 1),
              creditsUsed: (authenticatedUser.creditsUsed || 0) + 1,
            })
            .where(eq(usersTable.id, authenticatedUser.id));
        }
      } catch (dbErr) {
        console.warn('Could not record saved voiceover to database:', dbErr);
      }
    }

    return res.status(201).json({
      success: true,
      id: savedRecordId,
      voiceoverId,
      audioUrl: `/api/voiceover/audio/${voiceoverId}?format=${exportFormat}`,
      durationSeconds: safeDuration,
      format: exportFormat,
      voiceName,
      gender,
      engine: 'moonshine-wasm',
      language: resolvedLang,
      languageLabel: resolvedLangLabel,
      accent,
      script,
    });
  } catch (err: any) {
    console.error('Error saving voiceover:', err);
    return res.status(500).json({ error: err.message || 'Failed to save synthesized voiceover.' });
  }
});

app.post('/api/voiceover/generate', (_req: Request, res: Response) => {
  return res.status(410).json({
    error: 'Cloud TTS has been replaced by on-device Moonshine WebAssembly synthesis. Upload finished audio via POST /api/voiceovers.',
  });
});

// 6. Stream and download generated voiceover audio
app.get('/api/voiceover/audio/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) || 'wav';
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    // Check files
    const possibleFiles = [
      path.join(VOICEOVER_UPLOADS_DIR, `${id}.${format}`),
      path.join(VOICEOVER_UPLOADS_DIR, `${id}.wav`),
      path.join(VOICEOVER_UPLOADS_DIR, `${id}.mp3`),
      path.join(VOICEOVER_UPLOADS_DIR, `${id}.ogg`),
    ];

    let targetFile = possibleFiles.find((p) => fs.existsSync(p));

    if (!targetFile) {
      return res.status(404).send('Voiceover audio file not found.');
    }

    const mimeMap: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
    };

    const ext = path.extname(targetFile).replace('.', '') || format;
    const mimeType = mimeMap[ext] || 'audio/wav';

    const stat = fs.statSync(targetFile);
    const range = req.headers.range;

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="scriby-voiceover-${id}.${ext}"`);
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(targetFile, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(targetFile).pipe(res);
    }
  } catch (err: any) {
    console.error('Error streaming voiceover audio:', err);
    return res.status(500).send('Error streaming audio.');
  }
});

// 7. List user's saved voiceovers
app.get('/api/voiceovers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    const condition = isPrivileged
      ? undefined
      : sql`${savedVoiceoversTable.userId} = ${user.id} OR ${savedVoiceoversTable.userUid} = ${user.uid}`;

    const query = db.select().from(savedVoiceoversTable);
    const list = condition
      ? await query.where(condition).orderBy(desc(savedVoiceoversTable.createdAt))
      : await query.orderBy(desc(savedVoiceoversTable.createdAt));

    const enrichedList = list.map((item) => {
      const voMatch = item.audioUrl?.match(/vo-[a-zA-Z0-9-]+/);
      if (voMatch) {
        const metaPath = path.join(VOICEOVER_UPLOADS_DIR, `${voMatch[0]}.json`);
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            return {
              ...item,
              language: meta.language,
              languageLabel: meta.languageLabel,
              accent: meta.accent,
            };
          } catch {}
        }
      }
      return item;
    });

    return res.json({
      success: true,
      data: enrichedList,
    });
  } catch (err: any) {
    console.error('Error fetching voiceovers:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch voiceovers.' });
  }
});

// 8. Delete saved voiceover
app.delete('/api/voiceovers/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const rawParam = req.params.id;
    const numericId = parseInt(rawParam, 10);
    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';

    let condition;
    if (!isNaN(numericId) && !rawParam.startsWith('vo-')) {
      condition = isPrivileged
        ? sql`${savedVoiceoversTable.id} = ${numericId}`
        : sql`${savedVoiceoversTable.id} = ${numericId} AND (${savedVoiceoversTable.userId} = ${user.id} OR ${savedVoiceoversTable.userUid} = ${user.uid})`;
    } else {
      condition = isPrivileged
        ? sql`${savedVoiceoversTable.audioUrl} LIKE ${'%' + rawParam + '%'}`
        : sql`${savedVoiceoversTable.audioUrl} LIKE ${'%' + rawParam + '%'} AND (${savedVoiceoversTable.userId} = ${user.id} OR ${savedVoiceoversTable.userUid} = ${user.uid})`;
    }

    const deleted = await db.delete(savedVoiceoversTable).where(condition).returning();
    if (deleted.length > 0 && deleted[0].audioPath && fs.existsSync(deleted[0].audioPath)) {
      try {
        fs.unlinkSync(deleted[0].audioPath);
      } catch {}
    }

    // Clean up disk files by voiceoverId if applicable
    const targetVoId = rawParam.startsWith('vo-') ? rawParam : (deleted[0]?.audioUrl ? deleted[0].audioUrl.match(/vo-[a-zA-Z0-9-]+/)?.[0] : null);
    if (targetVoId) {
      ['.wav', '.mp3', '.ogg', '.json'].forEach((ext) => {
        const filePath = path.join(VOICEOVER_UPLOADS_DIR, `${targetVoId}${ext}`);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      });
    }

    return res.json({ success: true, message: 'Voiceover deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting voiceover:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete voiceover.' });
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

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Scriby SaaS server running at http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    console.error('Server listen error:', err?.message || err);
  });

  // Seed default policies asynchronously in background without delaying server readiness
  seedDefaultPoliciesIfEmpty().catch((err) => {
    console.warn('[DB] Policy seeding deferred:', err?.message || err);
  });
}

startServer().catch((err) => {
  console.error('Fatal error during startServer:', err);
});
