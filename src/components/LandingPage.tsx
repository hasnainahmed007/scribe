import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Check,
  ArrowRight,
  Download,
  Clock,
  FileAudio,
  Youtube,
  Mail,
  Send,
  MapPin,
  CheckCircle2,
  Building2,
  SlidersHorizontal,
  ShieldCheck,
  FileText,
  Scale,
  CreditCard,
  Lock,
  Sparkles,
  BookOpen,
  Mic,
  Volume2,
  VolumeX,
  Layers,
  Wand2,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle,
} from 'lucide-react';
import { SAMPLE_AUDIOS } from '../data/sampleAudios';
import { SaaSPlan, PolicySlug } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { PolicyModal } from './PolicyModal';
import { contactFormSchema, formatZodFieldErrors } from '../schemas/validation';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onExploreStudio?: () => void;
  onOpenPricing?: () => void;
}

const DEFAULT_PLANS: SaaSPlan[] = [
  {
    id: 'plan-free',
    name: 'Free Starter',
    description: 'Instant 30 minutes of free audio transcription on registration',
    priceBdt: 0,
    priceUsd: 0,
    interval: 'monthly',
    creditsGranted: 30,
    features: [
      '30 free audio minutes included',
      'SRT and TXT subtitle export',
      'Interactive waveform audio player',
      'Multilingual AI speech recognition (100+ languages)',
      'Standard processing queue',
    ],
    modules: ['subtitles_editor', 'voice_recorder'],
    isPopular: false,
    isActive: true,
  },
  {
    id: 'plan-pro',
    name: 'Pro Creator',
    description: 'Tailored for active YouTubers, video editors, and content producers',
    priceBdt: 999,
    priceUsd: 10,
    interval: 'monthly',
    creditsGranted: 300,
    features: [
      '300 audio minutes every month',
      'All export formats (SRT, DOCX, TXT, JSON)',
      'AI YouTube title and chapter generation',
      '16:9 HD thumbnail canvas studio',
      'Priority audio transcription queue',
      'Cloud transcript archive & search',
    ],
    modules: ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export'],
    isPopular: true,
    isActive: true,
  },
  {
    id: 'plan-agency',
    name: 'Agency Studio',
    description: 'High-volume capacity for production agencies and media channels',
    priceBdt: 2499,
    priceUsd: 25,
    interval: 'monthly',
    creditsGranted: 1200,
    features: [
      '1,200 audio minutes every month',
      'AI Voiceover & Voice Cloning Studio module',
      'Microphone voice cloning & custom voice profiles',
      'Full API and batch processing suite',
      'Unlimited 4K thumbnail exports (PNG, JPG, WEBP)',
      'Priority 24/7 dedicated creator support',
    ],
    modules: ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export', 'batch_processing', 'voiceover_studio'],
    isPopular: false,
    isActive: true,
  },
];

const THUMBNAIL_DEMO_PRESETS = [
  {
    name: 'Breaking News',
    headline: 'EXPOSED: The Secret Behind AI Audio',
    subhead: 'Master 2026 Multimodal Workflows Today',
    badge: 'URGENT',
    badgeColor: '#EF4444',
    bg1: '#0F172A',
    bg2: '#7F1D1D',
    textColor: '#FACC15',
  },
  {
    name: 'Tech Review',
    headline: 'Top 5 AI Audio Tools You Need Right Now',
    subhead: 'The Ultimate Guide for Digital Creators',
    badge: '4K ULTRA',
    badgeColor: '#1ed760',
    bg1: '#090D16',
    bg2: '#064E3B',
    textColor: '#FFFFFF',
  },
  {
    name: 'Podcast Host',
    headline: 'The Real Secret to Viral Content Success',
    subhead: 'Special In-Depth Creator Interview',
    badge: 'NEW EPISODE',
    badgeColor: '#8B5CF6',
    bg1: '#1E1B4B',
    bg2: '#31104B',
    textColor: '#E0E7FF',
  },
  {
    name: 'Masterclass',
    headline: 'Generate Auto Subtitles in 1 Click',
    subhead: 'Full Walkthrough for Web & Mobile',
    badge: '100% FREE',
    badgeColor: '#F59E0B',
    bg1: '#18181B',
    bg2: '#451A03',
    textColor: '#FDE047',
  },
];

const FAQS = [
  {
    q: 'What languages and audio formats does Scriby support?',
    a: 'Scriby supports audio transcription across 100+ global languages including Bengali (বাংলা), English, Hindi, Arabic, Spanish, and French. We accept all common audio and video formats including MP3, WAV, OGG, M4A, AAC, and FLAC up to 50MB per upload.',
  },
  {
    q: 'How does the AI Voiceover & Voice Cloning Studio work in the Agency plan?',
    a: 'Agency Studio members have exclusive access to voice cloning and TTS voiceovers. You can record a short 10-30 second speech sample through your microphone or upload an audio file to train a personalized voice profile. You can also generate high-fidelity speech using our built-in studio voices (Kabir and Fatima) and export in WAV, MP3, or OGG.',
  },
  {
    q: 'Can I export subtitles into Adobe Premiere, DaVinci Resolve, or CapCut?',
    a: 'Yes! You can download synchronized SubRip (.srt), WebVTT (.vtt), Word document (.docx) tables with timestamp columns, plain text (.txt), and structured JSON captions that import directly into any professional video editor.',
  },
  {
    q: 'Do I retain commercial rights and intellectual property to my files?',
    a: 'Yes, 100%. You retain full ownership, copyright, and commercial licensing rights to all uploaded media recordings, generated subtitles, synthesized voiceovers, and YouTube thumbnails created on the platform.',
  },
  {
    q: 'How do mobile payments with bKash, Nagad, and Rocket work?',
    a: 'When upgrading, select your payment method (bKash, Nagad, or Rocket). Send the plan amount via the provider app or USSD (*247#, *167#, *322#) to our official merchant account, enter your Transaction ID (TrxID) and mobile number in the checkout form, and your plan and audio minutes activate immediately.',
  },
  {
    q: 'What happens when I consume all my audio minutes?',
    a: 'You can upgrade your subscription tier at any time or add top-up audio minutes. Your saved transcripts, voice clones, and thumbnail templates remain permanently archived in your secure workspace history.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onOpenPricing,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [plans, setPlans] = useState<SaaSPlan[]>(DEFAULT_PLANS);

  // Interactive Studio Showcase Tab: 'subtitles' | 'voiceover' | 'thumbnail' | 'youtube_seo'
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'subtitles' | 'voiceover' | 'thumbnail' | 'youtube_seo'>('subtitles');

  // Subtitle Demo State
  const [activeDemoSample, setActiveDemoSample] = useState(SAMPLE_AUDIOS[0]);

  // Voiceover Audio Preview State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Thumbnail Studio Demo State
  const [activeThumbnailPreset, setActiveThumbnailPreset] = useState(THUMBNAIL_DEMO_PRESETS[0]);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Policy Modal State (Terms, Privacy, Refund)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicySlug, setSelectedPolicySlug] = useState<PolicySlug>('terms');

  const handleOpenPolicy = (slug: PolicySlug) => {
    setSelectedPolicySlug(slug);
    setIsPolicyModalOpen(true);
  };

  // Contact Form State (Zod Validated)
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [isSendingContact, setIsSendingContact] = useState(false);

  useEffect(() => {
    safeFetchJson<{ success: boolean; data: SaaSPlan[] }>('/api/plans').then((res) => {
      if (res.ok && res.data?.data && res.data.data.length > 0) {
        setPlans(res.data.data);
      }
    });
  }, []);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const handleToggleVoiceSample = (voiceId: string, sampleUrl: string) => {
    if (playingVoiceId === voiceId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(sampleUrl);
    audioPlayerRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
    audio.onerror = () => {
      setPlayingVoiceId(null);
    };
    audio.play().catch(() => {
      setPlayingVoiceId(null);
    });
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactErrors({});

    const parse = contactFormSchema.safeParse({
      name: contactName,
      email: contactEmail,
      subject: contactSubject,
      message: contactMessage,
    });

    if (!parse.success) {
      setContactErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsSendingContact(true);

    setTimeout(() => {
      setIsSendingContact(false);
      setContactSubmitted(true);
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    }, 600);
  };

  const handleSelectPlan = () => {
    if (isAuthenticated) {
      if (onOpenPricing) onOpenPricing();
    } else {
      onGetStarted();
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative text-white selection:bg-[#1ed760] selection:text-black overflow-hidden">
      {/* ========================================================= */}
      {/* 0. INTERACTIVE ANIMATED BACKGROUND MESH & PARTICLES       */}
      {/* ========================================================= */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Glow Orb 1 - Spotify Emerald */}
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full bg-[#1ed760]/12 blur-[140px] animate-pulse-glow" />

        {/* Glow Orb 2 - Deep Cyber Blue */}
        <div className="absolute top-[28%] -right-20 w-[550px] h-[550px] rounded-full bg-[#0284c7]/10 blur-[150px] animate-pulse-glow-slow" />

        {/* Glow Orb 3 - Studio Violet (Agency Voiceover Accent) */}
        <div className="absolute top-[65%] left-1/10 w-[500px] h-[500px] rounded-full bg-[#8b5cf6]/10 blur-[160px] animate-pulse-glow" />

        {/* Subtle Geometric Background Dot Grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 space-y-28 sm:space-y-36 pb-24">
        {/* ========================================================= */}
        {/* 1. HERO SECTION (HIGH IMPACT, EXPANSIVE TYPOGRAPHY)       */}
        {/* ========================================================= */}
        <section id="home" className="pt-10 sm:pt-20 max-w-5xl mx-auto px-4 text-center">
          {/* Subtle Metadata Kicker */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181818] border border-[#282828] text-xs font-semibold text-[#b3b3b3] mb-8 shadow-sm">
            <span className="text-white">Multilingual Speech AI</span>
            <span className="text-[#4d4d4d]">·</span>
            <span>Subtitle Studio</span>
            <span className="text-[#4d4d4d]">·</span>
            <span className="text-purple-400 font-bold">Voice Cloning</span>
            <span className="text-[#4d4d4d]">·</span>
            <span>16:9 Thumbnails</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08] mb-6 font-display text-balance">
            The Complete AI Audio, Subtitle & Creator Intelligence Suite.
          </h1>

          {/* Body Copy */}
          <p className="text-base sm:text-lg text-[#b3b3b3] max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
            Transcribe speech in any language with synchronized subtitle timestamps, clone your voice for multilingual voiceovers, generate high-CTR YouTube metadata, and export 16:9 thumbnails in any resolution.
          </p>

          {/* Primary & Secondary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <Button
              size="lg"
              onClick={onGetStarted}
              className="h-12 px-8 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold rounded-full shadow-[0_4px_20px_rgba(30,215,96,0.3)] transition-all cursor-pointer flex items-center gap-2"
            >
              <span>{isAuthenticated ? 'Open Studio Workspace' : 'Get Started Free (30 Mins)'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => scrollToSection('showcase')}
              className="h-12 px-8 border-[#383838] hover:bg-[#202020] text-white font-bold rounded-full transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Explore Interactive Demos</span>
              <Sparkles className="w-4 h-4 text-[#1ed760]" />
            </Button>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#7c7c7c]">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#1ed760]" />
              <span>30 free minutes on signup</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#1ed760]" />
              <span>No credit card required</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#1ed760]" />
              <span>100% intellectual property ownership</span>
            </span>
          </div>

          {/* Floating Key Metrics Strip */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="p-4 rounded-2xl bg-[#181818]/80 border border-[#282828] backdrop-blur-md text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#1ed760] font-mono">99.2%</div>
              <div className="text-[11px] text-[#878787] mt-1 font-medium">Acoustic Accuracy</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#181818]/80 border border-[#282828] backdrop-blur-md text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">100+</div>
              <div className="text-[11px] text-[#878787] mt-1 font-medium">Global Languages</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#181818]/80 border border-[#282828] backdrop-blur-md text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">Studio</div>
              <div className="text-[11px] text-[#878787] mt-1 font-medium">Voice Cloning & TTS</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#181818]/80 border border-[#282828] backdrop-blur-md text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">4K UHD</div>
              <div className="text-[11px] text-[#878787] mt-1 font-medium">Thumbnail Canvas</div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. INTERACTIVE 4-IN-1 STUDIO WORKBENCH DEMO SHOWCASE      */}
        {/* ========================================================= */}
        <section id="showcase" className="max-w-5xl mx-auto px-4 text-left">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
              Interactive Product Showcase
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 mb-2 font-display">
              Test Every Feature Before You Sign Up
            </h2>
            <p className="text-xs sm:text-sm text-[#b3b3b3]">
              Switch between the live interactive demos below to experience our subtitle alignment, studio voiceovers, 16:9 thumbnail canvas, and YouTube SEO engine.
            </p>
          </div>

          <div className="bg-[#181818] border border-[#282828] rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* 4 Interactive Feature Tabs Header */}
            <div className="p-2 sm:p-3 border-b border-[#282828] bg-[#141414] grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveShowcaseTab('subtitles')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                  activeShowcaseTab === 'subtitles'
                    ? 'bg-[#282828] text-white shadow-sm'
                    : 'text-[#878787] hover:text-white'
                }`}
              >
                <FileAudio className="w-4 h-4 text-[#1ed760]" />
                <span className="truncate">Subtitle Studio</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveShowcaseTab('voiceover')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                  activeShowcaseTab === 'voiceover'
                    ? 'bg-[#282828] text-white shadow-sm'
                    : 'text-[#878787] hover:text-white'
                }`}
              >
                <Mic className="w-4 h-4 text-purple-400" />
                <span className="truncate">Voiceover & Clone</span>
                <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold uppercase tracking-wider">Agency</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveShowcaseTab('thumbnail')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                  activeShowcaseTab === 'thumbnail'
                    ? 'bg-[#282828] text-white shadow-sm'
                    : 'text-[#878787] hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="truncate">16:9 Thumbnail</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveShowcaseTab('youtube_seo')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                  activeShowcaseTab === 'youtube_seo'
                    ? 'bg-[#282828] text-white shadow-sm'
                    : 'text-[#878787] hover:text-white'
                }`}
              >
                <Youtube className="w-4 h-4 text-red-500" />
                <span className="truncate">YouTube SEO</span>
              </button>
            </div>

            {/* TAB 1: SUBTITLE STUDIO INTERACTIVE DEMO */}
            {activeShowcaseTab === 'subtitles' && (
              <div className="p-5 sm:p-7 space-y-5 bg-[#121212]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Synchronized Subtitle Timestamp Alignment</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1ed760]/10 text-[#1ed760] font-semibold border border-[#1ed760]/20">
                        Live Demo
                      </span>
                    </h3>
                    <p className="text-xs text-[#878787] mt-0.5">
                      Select sample categories to see instant timestamped speech blocks:
                    </p>
                  </div>

                  {/* Sample Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-[#1a1a1a] rounded-xl border border-[#2e2e2e] overflow-x-auto">
                    {SAMPLE_AUDIOS.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => setActiveDemoSample(sample)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          activeDemoSample.id === sample.id
                            ? 'bg-[#2c2c2c] text-white'
                            : 'text-[#878787] hover:text-white'
                        }`}
                      >
                        {sample.category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Segments Display */}
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {activeDemoSample.segments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="p-3.5 rounded-xl bg-[#181818] border border-[#282828] flex items-start gap-3 hover:border-[#383838] transition-colors"
                    >
                      <span className="text-xs font-mono font-bold text-[#1ed760] shrink-0 pt-0.5 tabular-nums bg-[#1ed760]/10 px-2 py-0.5 rounded border border-[#1ed760]/20">
                        {seg.start}s – {seg.end}s
                      </span>
                      <p className="text-xs text-white leading-relaxed flex-1 font-medium">
                        {seg.text}
                      </p>
                      <span className="text-xs text-[#878787] font-mono tabular-nums shrink-0">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bottom Supported Formats */}
                <div className="pt-3 border-t border-[#242424] flex flex-wrap items-center justify-between gap-3 text-xs text-[#878787]">
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-[#1ed760]" />
                    <span>Download Ready:</span>
                    <span className="text-white font-mono font-bold">SRT · VTT · Word (.docx) · TXT · JSON</span>
                  </div>

                  <Button
                    size="sm"
                    onClick={onGetStarted}
                    className="bg-[#1ed760] text-black font-extrabold text-xs cursor-pointer"
                  >
                    <span>Transcribe Your Audio Now</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: AI VOICEOVER & VOICE CLONING (AGENCY TIER) */}
            {activeShowcaseTab === 'voiceover' && (
              <div className="p-5 sm:p-7 space-y-5 bg-[#121212]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242424]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        AI Voiceover & Voice Cloning Studio
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                        Agency Studio Module
                      </span>
                    </div>
                    <p className="text-xs text-[#b3b3b3] mt-0.5">
                      Synthesize natural speech with studio voices or clone your own voice from a 15-second recording:
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                    Export: WAV · MP3 · OGG
                  </span>
                </div>

                {/* Built-in Studio Voices Showcase with Live Audio Preview Playback */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Kabir Voice */}
                  <div className="p-4 rounded-2xl bg-[#181818] border border-[#2e2e2e] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                          K
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Kabir (Male Studio Broadcast)</div>
                          <div className="text-xs text-[#b3b3b3]">Deep, articulate, resonant tone for explainers & news</div>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold">
                        Studio 24kHz
                      </span>
                    </div>

                    <p className="text-xs text-[#b3b3b3] italic bg-[#121212] p-2.5 rounded-xl border border-[#242424]">
                      "Welcome to our comprehensive technical explainer on multimodal artificial intelligence."
                    </p>

                    <button
                      type="button"
                      onClick={() => handleToggleVoiceSample('male-default', '/api/voices/male-default/sample')}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        playingVoiceId === 'male-default'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-[#222222] hover:bg-[#2c2c2c] text-white border border-[#383838]'
                      }`}
                    >
                      {playingVoiceId === 'male-default' ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause Audio Sample</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Listen to Kabir's Voice Sample</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Fatima Voice */}
                  <div className="p-4 rounded-2xl bg-[#181818] border border-[#2e2e2e] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                          F
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Fatima (Female Studio Narrative)</div>
                          <div className="text-xs text-[#b3b3b3]">Warm, melodic, articulate storytelling tone for tutorials</div>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 font-semibold">
                        Studio 24kHz
                      </span>
                    </div>

                    <p className="text-xs text-[#b3b3b3] italic bg-[#121212] p-2.5 rounded-xl border border-[#242424]">
                      "Turn any audio recording into synchronized subtitles in seconds with perfect accuracy."
                    </p>

                    <button
                      type="button"
                      onClick={() => handleToggleVoiceSample('female-default', '/api/voices/female-default/sample')}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        playingVoiceId === 'female-default'
                          ? 'bg-rose-500 text-white shadow-md'
                          : 'bg-[#222222] hover:bg-[#2c2c2c] text-white border border-[#383838]'
                      }`}
                    >
                      {playingVoiceId === 'female-default' ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause Audio Sample</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Listen to Fatima's Voice Sample</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Voice Cloning Flow Highlights */}
                <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Instant Microphone Voice Cloning</div>
                      <div className="text-[11px] text-[#878787]">Record 15 seconds to clone your voice and generate speech in any script</div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      if (onOpenPricing) onOpenPricing();
                      else onGetStarted();
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    <span>Unlock Agency Voiceover</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: 16:9 THUMBNAIL CANVAS STUDIO DEMO */}
            {activeShowcaseTab === 'thumbnail' && (
              <div className="p-5 sm:p-7 space-y-5 bg-[#121212]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>16:9 Thumbnail Canvas & AI Style Generator</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                        Live Preview
                      </span>
                    </h3>
                    <p className="text-xs text-[#878787] mt-0.5">
                      Switch preset styles to see instant typography and gradient preview:
                    </p>
                  </div>

                  {/* Thumbnail Preset Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-[#1a1a1a] rounded-xl border border-[#2e2e2e] overflow-x-auto">
                    {THUMBNAIL_DEMO_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveThumbnailPreset(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          activeThumbnailPreset.name === preset.name
                            ? 'bg-[#2c2c2c] text-white'
                            : 'text-[#878787] hover:text-white'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 16:9 Preview Stage Simulation */}
                <div
                  className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-2xl p-6 sm:p-10 flex flex-col justify-between border border-[#3e3e3e]"
                  style={{
                    background: `linear-gradient(135deg, ${activeThumbnailPreset.bg1}, ${activeThumbnailPreset.bg2})`,
                  }}
                >
                  {/* Top Bar with Badge and Watermark */}
                  <div className="flex items-center justify-between">
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-black tracking-wider text-black shadow-md uppercase"
                      style={{ backgroundColor: activeThumbnailPreset.badgeColor }}
                    >
                      {activeThumbnailPreset.badge}
                    </span>

                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Title and Subtitle */}
                  <div className="space-y-2 max-w-xl">
                    <h4
                      className="text-xl sm:text-3xl md:text-4xl font-black leading-tight tracking-tight drop-shadow-md"
                      style={{ color: activeThumbnailPreset.textColor }}
                    >
                      {activeThumbnailPreset.headline}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-200 font-semibold drop-shadow">
                      {activeThumbnailPreset.subhead}
                    </p>
                  </div>

                  {/* Resolution Footnote */}
                  <div className="flex justify-between items-center text-xs text-white/80 font-mono tabular-nums">
                    <span>16:9 YouTube Standard</span>
                    <span>1280 × 720 HD · Export PNG / JPEG / WEBP</span>
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="pt-3 border-t border-[#242424] flex flex-wrap items-center justify-between gap-3 text-xs text-[#878787]">
                  <span>Supports Custom Dimensions up to 4K (3840×2160) and 9:16 Shorts / Reels.</span>
                  <Button
                    size="sm"
                    onClick={onGetStarted}
                    className="bg-[#1ed760] text-black font-extrabold text-xs cursor-pointer"
                  >
                    <span>Launch Thumbnail Studio</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 4: YOUTUBE SEO & CHAPTER METADATA DEMO */}
            {activeShowcaseTab === 'youtube_seo' && (
              <div className="p-5 sm:p-7 space-y-5 bg-[#121212]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>AI YouTube SEO & Metadata Optimizer</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold border border-red-500/20">
                        Live Preview
                      </span>
                    </h3>
                    <p className="text-xs text-[#878787] mt-0.5">
                      Extract high-CTR titles, timestamps, and hashtags directly from your audio transcript:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Generated Viral Titles */}
                  <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-2.5">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Optimized YouTube Titles (High-CTR)</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#121212] border border-[#242424] text-white font-medium flex items-center justify-between">
                        <span>1. Turn Audio into Subtitles in 1 Click (2026 Guide)</span>
                        <span className="text-xs text-[#1ed760] font-semibold shrink-0 ml-2">High CTR</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#121212] border border-[#242424] text-white font-medium flex items-center justify-between">
                        <span>2. How to Auto-Generate Bengali Subtitles Fast</span>
                        <span className="text-xs text-[#1ed760] font-semibold shrink-0 ml-2">Curated</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#121212] border border-[#242424] text-white font-medium flex items-center justify-between">
                        <span>3. Multimodal Speech Intelligence Explained Simply</span>
                        <span className="text-xs text-blue-400 font-semibold shrink-0 ml-2">Viral Pick</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamped Chapters */}
                  <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-2.5">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#1ed760]" />
                      <span>Auto-Generated Chapter Timestamps</span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-[#121212] border border-[#242424] flex items-center gap-3 text-slate-300">
                        <span className="text-[#1ed760] font-bold">00:00</span>
                        <span>Introduction & Audio Ingestion</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#121212] border border-[#242424] flex items-center gap-3 text-slate-300">
                        <span className="text-[#1ed760] font-bold">02:15</span>
                        <span>Multilingual Speech-to-Text Alignment</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#121212] border border-[#242424] flex items-center gap-3 text-slate-300">
                        <span className="text-[#1ed760] font-bold">05:40</span>
                        <span>Exporting SRT, Word DOCX & 16:9 Thumbnail</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#242424] flex items-center justify-between text-xs text-[#878787]">
                  <span>Generates bilingual SEO metadata in both Bengali and English based on audio language.</span>
                  <Button
                    size="sm"
                    onClick={onGetStarted}
                    className="bg-[#1ed760] text-black font-extrabold text-xs cursor-pointer"
                  >
                    <span>Try YouTube SEO Studio</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. 5-STEP END-TO-END WORKFLOW ROADMAP                     */}
        {/* ========================================================= */}
        <section className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
              Creator Pipeline
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 mb-2 font-display">
              From Raw Audio to Viral Video in 5 Minutes
            </h2>
            <p className="text-xs sm:text-sm text-[#b3b3b3]">
              Eliminate hours of manual transcription, subtitle typing, title brainstorming, and thumbnail design with one unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              {
                step: '01',
                title: 'Upload Audio',
                desc: 'Upload MP3, WAV, M4A or record voice live via microphone',
                icon: FileAudio,
              },
              {
                step: '02',
                title: 'Speech Alignment',
                desc: 'Scriby transcribes speech and synchronizes subtitle timestamps',
                icon: Clock,
              },
              {
                step: '03',
                title: 'Voiceover Synthesis',
                desc: 'Clone voice or generate studio narration in WAV/MP3/OGG',
                icon: Mic,
              },
              {
                step: '04',
                title: 'SEO & Thumbnails',
                desc: 'Extract viral titles and design 16:9 thumbnails with AI style',
                icon: Wand2,
              },
              {
                step: '05',
                title: '1-Click Export',
                desc: 'Download SRT, DOCX, audio formats, and 4K thumbnail images',
                icon: Download,
              },
            ].map((st, i) => {
              const Icon = st.icon;
              return (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-[#181818] border border-[#282828] hover:border-[#1ed760]/50 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#878787] font-mono">
                      <span className="text-[#1ed760] font-bold">Step {st.step}</span>
                      <Icon className="w-4 h-4 text-[#878787]" />
                    </div>
                    <h3 className="text-base font-bold text-white mt-2">{st.title}</h3>
                    <p className="text-xs text-[#b3b3b3] mt-1.5 leading-relaxed">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. 4 SYSTEM PILLARS DEEP-DIVE CARDS                       */}
        {/* ========================================================= */}
        <section id="about" className="max-w-5xl mx-auto px-4 pt-6 border-t border-[#282828]">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              System Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 mb-3 font-display">
              Designed for Creators, Podcasters & Media Agencies.
            </h2>
            <p className="text-xs sm:text-sm text-[#b3b3b3] leading-relaxed">
              Conventional tools only do one task. Scriby unites speech-to-text, subtitle editing, voice cloning, YouTube SEO, and thumbnail creation into a seamless creator suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Pillar 1: Subtitle Alignment */}
            <Card className="p-6 sm:p-7 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838] transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1ed760] uppercase tracking-wider">01. Subtitle Studio</span>
                  <FileAudio className="w-5 h-5 text-[#1ed760]" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Multilingual Subtitle Editor
                </h3>
                <p className="text-sm text-[#b3b3b3] leading-relaxed">
                  Universal script transcription supporting all major global languages and Bengali (বাংলা) with punctuation, speaker separation, timestamp adjustments, split points, and seekable waveform audio playback.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-[#b3b3b3]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1ed760] shrink-0" />
                    <span>Synchronized audio player timeline with active highlight</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1ed760] shrink-0" />
                    <span>Exports in SRT, WebVTT, Word DOCX tables, TXT, JSON</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[#282828] text-xs text-[#b3b3b3]">
                100+ Global Languages · Live Audio Sync
              </div>
            </Card>

            {/* Pillar 2: Voiceover & Voice Cloning */}
            <Card className="p-6 sm:p-7 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838] transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">02. Voice Cloning (Agency)</span>
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Voice Cloning & AI Voiceover Studio
                </h3>
                <p className="text-sm text-[#b3b3b3] leading-relaxed">
                  Clone your own voice from a microphone recording or generate professional narration using built-in studio voices (Kabir & Fatima). Send synthesized audio directly to the Subtitle Editor with 1 click.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-[#b3b3b3]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Instant voice clone profile from 15-second speech sample</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Multi-format audio export in high-fidelity WAV, MP3, and OGG</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[#282828] text-xs text-[#b3b3b3]">
                Agency Studio Plan · 24kHz Studio Output
              </div>
            </Card>

            {/* Pillar 3: Thumbnail Studio */}
            <Card className="p-6 sm:p-7 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838] transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">03. Thumbnail Canvas</span>
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  16:9 Thumbnail Canvas Studio
                </h3>
                <p className="text-sm text-[#b3b3b3] leading-relaxed">
                  Design high-CTR YouTube thumbnails with live side-by-side sticky canvas preview. Generate background art with AI in 6 distinct styles, tweak typography, and export at custom resolutions.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-[#b3b3b3]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>AI style background generator (Cinematic, Cyberpunk, 3D)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Custom dimensions up to 4K UHD with PNG, JPEG, WEBP exports</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[#282828] text-xs text-[#b3b3b3]">
                Sticky Live 16:9 Canvas · Multi-Format Downloads
              </div>
            </Card>

            {/* Pillar 4: YouTube SEO */}
            <Card className="p-6 sm:p-7 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838] transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">04. YouTube SEO</span>
                  <Youtube className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  YouTube SEO & Metadata Suite
                </h3>
                <p className="text-sm text-[#b3b3b3] leading-relaxed">
                  Transform spoken words into ranking YouTube titles, description summaries, hashtags, and chapter timestamps with bilingual Bengali & English support.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-[#b3b3b3]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>High-converting titles tailored for click-through rate</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Exact chapter timestamps mapped to transcript audio times</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-[#282828] text-xs text-[#b3b3b3]">
                Multilingual SEO Engine · 1-Click Copy
              </div>
            </Card>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. PRICING & SUBSCRIPTION TIERS                           */}
        {/* ========================================================= */}
        <section id="pricing" className="max-w-5xl mx-auto px-4 pt-6 border-t border-[#282828]">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
              Transparent Creator Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 mb-3 font-display">
              Simple Credit-Based Subscription Plans
            </h2>
            <p className="text-xs sm:text-sm text-[#b3b3b3]">
              Every new user gets 30 free minutes on signup. Upgrade to Pro Creator for full exports and thumbnails, or Agency Studio for voice cloning and 1,200 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isAgency = plan.id === 'plan-agency';
              const isPro = plan.id === 'plan-pro' || plan.isPopular;
              const priceLabel = plan.priceUsd === 0 ? '$0' : `$${plan.priceUsd}`;
              const bdtSubLabel =
                plan.priceBdt > 0 ? `৳${plan.priceBdt.toLocaleString()} BDT / month` : 'Free starter allowance';

              return (
                <Card
                  key={plan.id}
                  className={`p-6 sm:p-7 flex flex-col justify-between transition-all bg-[#181818] rounded-3xl ${
                    isAgency
                      ? 'border-purple-500 shadow-[0_8px_32px_rgba(139,92,246,0.18)] relative'
                      : isPro
                      ? 'border-[#1ed760] shadow-[0_8px_32px_rgba(30,215,96,0.15)] relative'
                      : 'border-[#282828] hover:border-[#383838]'
                  }`}
                >
                  <div>
                    {isAgency && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold bg-purple-600 text-white shadow-md uppercase tracking-wider">
                        Includes Voice Cloning
                      </div>
                    )}
                    {isPro && !isAgency && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold bg-[#1ed760] text-black shadow-md uppercase tracking-wider">
                        Most Popular
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                        isAgency
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                          : isPro
                          ? 'bg-[#1ed760]/10 text-[#1ed760] border-[#1ed760]/20'
                          : 'bg-white/5 text-slate-300 border-white/10'
                      }`}>
                        {plan.creditsGranted} mins
                      </span>
                    </div>

                    <p className="text-sm text-[#b3b3b3] mb-6 min-h-[42px] leading-relaxed">
                      {plan.description}
                    </p>

                    <div className="pb-5 border-b border-[#282828] mb-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold font-mono tabular-nums text-white">
                          {priceLabel}
                        </span>
                        <span className="text-xs text-[#b3b3b3]">/ month</span>
                      </div>
                      <div className="text-xs text-[#1ed760] font-mono tabular-nums mt-1 font-semibold">
                        {bdtSubLabel}
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2.5 mb-8">
                      <div className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">
                        Included Features
                      </div>
                      <ul className="space-y-2.5 text-sm text-[#d4d4d4]">
                        {plan.features.map((feat, idx) => {
                          const isVoiceFeature = feat.toLowerCase().includes('voiceover') || feat.toLowerCase().includes('voice cloning');
                          return (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                                isVoiceFeature ? 'text-purple-400 font-bold' : 'text-[#1ed760]'
                              }`} />
                              <span className={isVoiceFeature ? 'text-purple-200 font-semibold' : ''}>
                                {feat}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  <Button
                    onClick={handleSelectPlan}
                    disabled={Boolean(user?.planId && user.planId !== 'plan-free' && plan.priceUsd === 0)}
                    variant={isAgency ? 'default' : isPro ? 'default' : 'outline'}
                    size="default"
                    className={`w-full py-2.5 font-extrabold text-sm cursor-pointer rounded-full ${
                      isAgency
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : isPro
                        ? 'bg-[#1ed760] hover:bg-[#1fdf64] text-black'
                        : 'border-[#383838] text-white hover:bg-[#282828]'
                    }`}
                  >
                    {user?.planId === plan.id
                      ? 'Current Active Plan'
                      : plan.priceUsd === 0
                      ? 'Get Started Free'
                      : isAuthenticated
                      ? `Select ${plan.name}`
                      : `Get Started with ${plan.name}`}
                  </Button>
                </Card>
              );
            })}
          </div>

          {/* Payment Gateways Strip */}
          <div className="mt-10 p-5 rounded-2xl bg-[#181818] border border-[#282828] flex flex-wrap items-center justify-between gap-4 text-xs text-[#b3b3b3]">
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-[#1ed760]" />
              <span>Instant mobile checkout supported via official gateways:</span>
              <span className="font-bold text-white">bKash (*247#) · Nagad (*167#) · Rocket (*322#)</span>
            </div>
            <span className="font-semibold text-[#1ed760] text-xs">
              Instant Quota Credit Allocation
            </span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 6. FREQUENTLY ASKED QUESTIONS (FAQ ACCORDION)             */}
        {/* ========================================================= */}
        <section className="max-w-4xl mx-auto px-4 pt-6 border-t border-[#282828]">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
              Creator FAQ
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 mb-2 font-display">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-[#b3b3b3]">
              Everything you need to know about transcription accuracy, voice cloning rights, and exports.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#181818] border border-[#282828] overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#1f1f1f] transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#1ed760] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#878787] shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 text-xs text-[#b3b3b3] leading-relaxed border-t border-[#242424] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 7. CONTACT & INQUIRIES SECTION                            */}
        {/* ========================================================= */}
        <section id="contact" className="max-w-5xl mx-auto px-4 pt-6 border-t border-[#282828]">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              Direct Contact
            </span>
            <h2 className="text-3xl font-bold text-white tracking-tight mt-1 mb-2 font-display">
              Have Questions or Need Custom Agency Quotas?
            </h2>
            <p className="text-xs sm:text-sm text-[#b3b3b3] leading-relaxed">
              Reach out to our engineering team for high-volume enterprise API access, custom voice models, or technical support.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Details Card */}
            <div className="lg:col-span-1 p-6 rounded-3xl bg-[#181818] border border-[#282828] flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-white">Direct Channels</h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#1ed760] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#878787]">Email Inquiries</div>
                      <div className="text-xs font-bold text-white mt-0.5">support@scriby.com</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#1ed760] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#878787]">Cloud Infrastructure</div>
                      <div className="text-xs font-bold text-white mt-0.5">Global Cloud Hosting (Asia-Pacific)</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-[#1ed760] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#878787]">Response SLA</div>
                      <div className="text-xs font-bold text-white mt-0.5">Within 24 Hours</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#282828] text-xs text-[#b3b3b3]">
                <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Media Agency Partnerships</span>
                </div>
                <p className="text-xs leading-relaxed">
                  For TV channels, podcast networks, and YouTube creators producing more than 100 hours per month, contact us for custom bulk pricing.
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2 p-6 sm:p-7 rounded-3xl bg-[#181818] border border-[#282828]">
              {contactSubmitted ? (
                <div className="py-12 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-[#1ed760] mx-auto" />
                  <h4 className="text-base font-bold text-white">Message Sent Successfully</h4>
                  <p className="text-xs text-[#b3b3b3] max-w-sm mx-auto leading-relaxed">
                    We have received your message and will reply to your email address within one business day.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContactSubmitted(false)}
                    className="mt-2 text-xs cursor-pointer"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#b3b3b3] block mb-1">Your Name</label>
                      <Input
                        type="text"
                        value={contactName}
                        onChange={(e) => {
                          setContactName(e.target.value);
                          if (contactErrors.name) setContactErrors({ ...contactErrors, name: '' });
                        }}
                        placeholder="e.g. Tanvir Hossain"
                        className="text-xs bg-[#121212] border-[#2e2e2e]"
                      />
                      {contactErrors.name && (
                        <p className="text-xs text-rose-400 mt-1">{contactErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-[#b3b3b3] block mb-1">Email Address</label>
                      <Input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => {
                          setContactEmail(e.target.value);
                          if (contactErrors.email) setContactErrors({ ...contactErrors, email: '' });
                        }}
                        placeholder="tanvir@studio.com"
                        className="text-sm bg-[#121212] border-[#2e2e2e]"
                      />
                      {contactErrors.email && (
                        <p className="text-xs text-rose-400 mt-1">{contactErrors.email}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#b3b3b3] block mb-1">Subject / Project Details</label>
                    <Input
                      type="text"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="e.g. Agency tier high-volume quota inquiry"
                      className="text-sm bg-[#121212] border-[#2e2e2e]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#b3b3b3] block mb-1">Message</label>
                    <textarea
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => {
                        setContactMessage(e.target.value);
                        if (contactErrors.message) setContactErrors({ ...contactErrors, message: '' });
                      }}
                      placeholder="Describe your audio production workflow, volume requirements, or questions..."
                      className="w-full px-4 py-2.5 bg-[#121212] border border-[#2e2e2e] rounded-2xl text-sm text-white placeholder-[#878787] focus:outline-none focus:border-[#1ed760] transition-colors"
                    />
                    {contactErrors.message && (
                      <p className="text-xs text-rose-400 mt-1">{contactErrors.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSendingContact}
                    size="default"
                    className="bg-[#1ed760] hover:bg-[#1fdf64] text-black font-extrabold text-xs px-6 rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingContact ? 'Sending Message...' : 'Send Inquiry'}</span>
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ================= LANDING PAGE FOOTER ================= */}
      <footer className="relative z-10 border-t border-[#282828] bg-[#0c0c0c] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Col 1: Brand & Bio (2 cols wide) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1ed760] text-black flex items-center justify-center font-black font-display shadow-lg shadow-[#1ed760]/20">
                  S
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight text-white font-display">
                    Scriby
                  </span>
                  <span className="block text-xs text-[#b3b3b3] tracking-wider uppercase">
                    Audio Speech & Creator Studio
                  </span>
                </div>
              </div>

              <p className="text-sm text-[#b3b3b3] leading-relaxed max-w-sm">
                Next-generation multilingual speech intelligence platform built for content creators, YouTube producers, podcasters, and media agencies. Transcribe audio across all languages, synthesize studio voiceovers & voice clones, generate high-CTR YouTube SEO, and design 16:9 thumbnails effortlessly.
              </p>

              <div className="flex items-center gap-3 pt-2 text-xs text-[#b3b3b3]">
                <span className="font-semibold text-[#1ed760]">Enterprise Cloud Security</span>
                <span>•</span>
                <span>Universal Multilingual Recognition</span>
              </div>
            </div>

            {/* Col 2: Studio Tools */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                Creator Suite
              </h4>
              <ul className="space-y-2 text-xs text-[#b3b3b3]">
                <li>
                  <button onClick={onGetStarted} className="hover:text-white transition-colors cursor-pointer text-left">
                    Multilingual Speech-to-Text
                  </button>
                </li>
                <li>
                  <button onClick={onGetStarted} className="hover:text-white transition-colors cursor-pointer text-left">
                    SRT & TXT Subtitle Editor
                  </button>
                </li>
                <li>
                  <button onClick={onGetStarted} className="hover:text-white transition-colors cursor-pointer text-left">
                    AI Voiceover & Voice Cloning (Agency)
                  </button>
                </li>
                <li>
                  <button onClick={onGetStarted} className="hover:text-white transition-colors cursor-pointer text-left">
                    16:9 Thumbnail Canvas Studio
                  </button>
                </li>
                <li>
                  <button onClick={onGetStarted} className="hover:text-white transition-colors cursor-pointer text-left">
                    YouTube SEO & Chapters AI
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Legal & Platform Policies */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Legal & Policies</span>
              </h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenPolicy('terms')}
                    className="text-[#b3b3b3] hover:text-[#1ed760] transition-colors flex items-center gap-2 group cursor-pointer text-left"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#878787] group-hover:text-[#1ed760] transition-colors" />
                    <span className="font-medium text-[#d4d4d4] group-hover:text-white">Terms and Conditions</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenPolicy('privacy')}
                    className="text-[#b3b3b3] hover:text-[#1ed760] transition-colors flex items-center gap-2 group cursor-pointer text-left"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#878787] group-hover:text-[#1ed760] transition-colors" />
                    <span className="font-medium text-[#d4d4d4] group-hover:text-white">Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenPolicy('refund')}
                    className="text-[#b3b3b3] hover:text-[#1ed760] transition-colors flex items-center gap-2 group cursor-pointer text-left"
                  >
                    <Scale className="w-3.5 h-3.5 text-[#878787] group-hover:text-[#1ed760] transition-colors" />
                    <span className="font-medium text-[#d4d4d4] group-hover:text-white">Refund Policy</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Payment Gateways */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Instant Mobile Payment</span>
              </h4>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Automated credit activation supported across Bangladesh:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* bKash */}
                <div className="px-3 py-1 rounded-full text-xs font-bold bg-[#e2136e]/15 text-[#ff4b8e] border border-[#e2136e]/30">
                  bKash
                </div>

                {/* Nagad */}
                <div className="px-3 py-1 rounded-full text-xs font-bold bg-[#f7941d]/15 text-[#ffa726] border border-[#f7941d]/30">
                  Nagad
                </div>

                {/* Rocket */}
                <div className="px-3 py-1 rounded-full text-xs font-bold bg-[#8c3494]/15 text-[#c084fc] border border-[#8c3494]/30">
                  Rocket
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs text-[#b3b3b3]">
                <Lock className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>256-Bit SSL Encrypted & OTP Protected</span>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="mt-12 pt-8 border-t border-[#1f1f1f] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#878787]">
            <div className="flex items-center gap-2">
              <span>© {new Date().getFullYear()} Scriby. All rights reserved.</span>
              <span>•</span>
              <span className="text-[#b3b3b3]">Built for Global Creators</span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => handleOpenPolicy('terms')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleOpenPolicy('privacy')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleOpenPolicy('refund')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Refund Policy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Dynamic Policy Modal */}
      <PolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        initialSlug={selectedPolicySlug}
      />
    </div>
  );
};
