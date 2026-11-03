export interface TranscriptSegment {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  speaker: string;
  text: string;
}

export interface AudioSource {
  url: string;
  name: string;
  size?: number;
  duration: number;
  blob?: Blob;
  mimeType: string;
  isSample?: boolean;
}

export interface YouTubeTitleItem {
  title: string;
  category: string;
  ctrScore?: number;
}

export interface YouTubeChapter {
  timestamp: string;
  title: string;
}

export interface SocialMediaPosts {
  facebook: string;
  instagram: string;
  linkedin: string;
  twitter: string;
}

export interface YouTubeMetadata {
  titles: YouTubeTitleItem[];
  description: string;
  chapters: YouTubeChapter[];
  tags: string[];
  socialPosts: SocialMediaPosts;
  thumbnailHeadlineIdeas: string[];
}

export interface ThumbnailConfig {
  headline: string;
  subhead: string;
  badge: string;
  showBadge: boolean;
  fontFamily: string;
  headlineSize: number;
  headlineColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  backgroundTheme: string;
  customBgColor1: string;
  customBgColor2: string;
  bgImageUrl?: string;
  bgImageOpacity: number;
  bgImageBlur: number;
  overlayVignette: boolean;
  accentBarColor: string;
  showAccentBar: boolean;
}

export type ActiveTab = 'landing' | 'studio' | 'youtube' | 'thumbnail' | 'history' | 'admin' | 'pricing' | 'auth';

export type AuthPageMode = 'login' | 'register' | 'verify-otp' | 'forgot-password' | 'reset-password';

// ================== SaaS & Database Credit Models ==================

export type PlanModule =
  | 'subtitles_editor'
  | 'advanced_export'
  | 'youtube_seo'
  | 'thumbnail_canvas'
  | 'voice_recorder'
  | 'batch_processing';

export type UserRole = 'superadmin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface SaaSUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  planId: string;
  planName: string;
  creditsRemaining: number; // in audio minutes
  creditsTotal: number;
  creditsUsed: number;
  planModules?: PlanModule[];
  createdAt: string;
}

export interface SaaSPlan {
  id: string;
  name: string;
  nameBn?: string;
  description: string;
  priceBdt: number;
  priceUsd: number;
  interval: 'monthly' | 'yearly';
  creditsGranted: number; // Audio minutes per month
  features: string[];
  modules?: PlanModule[];
  isPopular?: boolean;
  isActive?: boolean;
}

export interface SavedTranscript {
  id: number;
  userId: number;
  userUid?: string;
  title: string;
  audioName?: string;
  duration: number; // in seconds
  durationSeconds?: number;
  audioUrl?: string;
  segments: TranscriptSegment[];
  fullTranscript: string;
  summary?: string;
  wordCount?: number;
  createdAt: string;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

export interface SaaSSubscription {
  id: number;
  userId: number;
  userUid: string;
  userName?: string;
  userEmail?: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export type PaymentMethod = 'card' | 'bkash' | 'nagad' | 'stripe';
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface SaaSPayment {
  id: number;
  transactionId: string;
  userId: number;
  userEmail: string;
  planName: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
}

export interface UsageLog {
  id: number;
  userId: number;
  audioName: string;
  durationSeconds: number;
  creditsDeducted: number;
  transcribedAt: string;
}

export interface AuthState {
  user: SaaSUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}
