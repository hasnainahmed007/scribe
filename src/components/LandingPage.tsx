import React, { useState, useEffect } from 'react';
import {
  Play,
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
} from 'lucide-react';
import { SAMPLE_AUDIOS } from '../data/sampleAudios';
import { SaaSPlan } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

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
      'Bengali speech AI recognition',
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
      'Cloud SQL transcript archive & search',
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
      'Full API and batch processing suite',
      'Unlimited 16:9 thumbnail exports',
      'Multi-format subtitle packaging',
      'Multi-user team workspace access',
      'Priority 24/7 dedicated creator support',
    ],
    modules: ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export', 'batch_processing'],
    isPopular: false,
    isActive: true,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onOpenPricing,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [activeDemoSample, setActiveDemoSample] = useState(SAMPLE_AUDIOS[0]);
  const [plans, setPlans] = useState<SaaSPlan[]>(DEFAULT_PLANS);

  // Contact Form State
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

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!contactName.trim()) {
      errors.name = 'Please provide your name.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!contactEmail.trim()) {
      errors.email = 'Please provide your email address.';
    } else if (!emailRegex.test(contactEmail.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!contactMessage.trim()) {
      errors.message = 'Please enter your message.';
    } else if (contactMessage.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }

    setContactErrors({});
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

  const scrollToPricing = () => {
    const el = document.getElementById('pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-32 pb-24 text-white">
      {/* ========================================================= */}
      {/* 1. HERO SECTION (QUIET, EXPANSIVE SPOTIFY TYPOGRAPHY)    */}
      {/* ========================================================= */}
      <section id="home" className="pt-12 sm:pt-20 max-w-4xl mx-auto px-4 text-center">
        {/* Subtle, unboxed metadata */}
        <div className="text-xs font-semibold text-[#b3b3b3] tracking-wide mb-6">
          <span>Bengali Speech Recognition</span>
          <span className="mx-2 text-[#4d4d4d]">·</span>
          <span>Subtitle Alignment</span>
          <span className="mx-2 text-[#4d4d4d]">·</span>
          <span>Creator Publishing Suite</span>
        </div>

        {/* Primary Headline: Restrained white heading */}
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.12] mb-6">
          Turn Bengali voice recordings into accurate, synchronized subtitles.
        </h1>

        {/* Quiet Body Copy */}
        <p className="text-base sm:text-lg text-[#b3b3b3] max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          Engineered specifically for spoken Bengali dialects, conjunct letters (যুক্তবর্ণ), and English code-switching. Transcribe audio, edit subtitle blocks with live audio sync, and export in SRT, DOCX, TXT, or JSON.
        </p>

        {/* Primary & Secondary Pill CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-5">
          <Button
            size="lg"
            onClick={onGetStarted}
            className="px-8 shadow-[0_4px_16px_rgba(30,215,96,0.25)]"
          >
            <span>{isAuthenticated ? 'Open Studio Workspace' : 'Get Started Free'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={scrollToPricing}
            className="px-8"
          >
            <span>View Plans & Pricing</span>
          </Button>
        </div>

        {/* Quiet Trust Note */}
        <div className="text-xs text-[#7c7c7c]">
          30 minutes free starter audio quota on registration · No credit card required
        </div>

        {/* ========================================================= */}
        {/* INTERACTIVE AUDIO WORKBENCH (QUIET SPOTIFY DARK SURFACES) */}
        {/* ========================================================= */}
        <div className="mt-16 max-w-3xl mx-auto text-left">
          <div className="bg-[#181818] border border-[#282828] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Workbench Top Bar */}
            <div className="px-5 py-3 border-b border-[#282828] flex flex-wrap items-center justify-between gap-3 bg-[#141414]">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-white">Interactive Studio Preview</span>
                <span className="text-[#4d4d4d]">·</span>
                <span className="text-[#b3b3b3] font-mono text-[11px]">{activeDemoSample.durationFormatted}</span>
              </div>

              {/* Sample Tab Selectors */}
              <div className="flex items-center gap-1 p-0.5 bg-[#1f1f1f] rounded-full border border-[#282828] text-xs">
                {SAMPLE_AUDIOS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => setActiveDemoSample(sample)}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer text-xs font-bold ${
                      activeDemoSample.id === sample.id
                        ? 'bg-[#282828] text-white shadow-sm'
                        : 'text-[#b3b3b3] hover:text-white'
                    }`}
                  >
                    {sample.category}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Track Bar */}
            <div className="p-4 border-b border-[#282828] bg-[#181818] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_2px_8px_rgba(30,215,96,0.3)]">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {activeDemoSample.title}
                  </div>
                  <div className="text-[11px] text-[#b3b3b3] font-mono mt-0.5">
                    {activeDemoSample.segments.length} Synchronized Subtitle Blocks · 44.1kHz Audio
                  </div>
                </div>
              </div>

              <button
                onClick={onGetStarted}
                className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 bg-[#282828] hover:bg-[#383838] text-white text-xs font-bold rounded-full border border-[#383838] transition-colors cursor-pointer"
              >
                <span>Open in Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Subtitle Segments Preview */}
            <div className="p-4 space-y-2 bg-[#121212]">
              {activeDemoSample.segments.slice(0, 3).map((seg, idx) => (
                <div
                  key={seg.id}
                  className="p-3 rounded-xl bg-[#181818] border border-[#282828] flex items-start gap-3 hover:border-[#383838] transition-colors"
                >
                  <span className="text-[11px] font-mono text-[#1ed760] shrink-0 pt-0.5 tabular-nums font-bold">
                    {seg.start}s – {seg.end}s
                  </span>
                  <p className="text-xs font-medium text-white leading-relaxed flex-1">
                    {seg.text}
                  </p>
                  <span className="text-[10px] text-[#7c7c7c] font-mono shrink-0">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Format Badges Strip */}
            <div className="px-5 py-2.5 border-t border-[#282828] bg-[#141414] flex items-center justify-between text-xs text-[#b3b3b3]">
              <span className="font-mono text-[11px]">Supported Formats:</span>
              <div className="flex items-center gap-3 font-mono text-[11px] text-white font-bold">
                <span>SRT</span>
                <span className="text-[#4d4d4d]">·</span>
                <span>VTT</span>
                <span className="text-[#4d4d4d]">·</span>
                <span>DOCX</span>
                <span className="text-[#4d4d4d]">·</span>
                <span>TXT</span>
                <span className="text-[#4d4d4d]">·</span>
                <span>JSON</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. CAPABILITIES (EDITORIAL RESTRAINT & SPOTIFY CARDS)     */}
      {/* ========================================================= */}
      <section id="about" className="max-w-4xl mx-auto px-4 pt-8 border-t border-[#282828]">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">
            System Capabilities
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
            Built deliberately for Bengali language workflows.
          </h2>
          <p className="text-sm text-[#b3b3b3] leading-relaxed">
            Conventional speech-to-text models struggle with Bengali conjuncts (যুক্তবর্ণ), vowel markers, and technical terminology. BanglaScribe combines high-fidelity multimodal acoustic intelligence with an editorial subtitle toolset.
          </p>
        </div>

        {/* 4 Pillars with Restrained Styling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#1ed760] font-bold">01</span>
                <FileAudio className="w-4 h-4 text-[#b3b3b3]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Acoustic Speech Recognition
              </h3>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Native Bengali script transcription with accurate punctuation, conjunct resolution, and natural handling of mixed English and Bengali terminology.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#282828] text-[11px] text-[#7c7c7c] font-mono">
              Dialect-Adaptive Vocabulary
            </div>
          </Card>

          <Card className="p-6 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#1ed760] font-bold">02</span>
                <Clock className="w-4 h-4 text-[#b3b3b3]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Synchronized Subtitle Editor
              </h3>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Integrated seekable audio player, timestamp adjustment, segment merging, split points, and real-time Text-to-Speech (TTS) verification.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#282828] text-[11px] text-[#7c7c7c] font-mono">
              Timestamp Precision
            </div>
          </Card>

          <Card className="p-6 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#1ed760] font-bold">03</span>
                <Download className="w-4 h-4 text-[#b3b3b3]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Multi-Format File Exports
              </h3>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Clean exports compatible with Adobe Premiere Pro, DaVinci Resolve, CapCut, and YouTube Studio with SubRip (.srt), Word (.docx), and structured JSON.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#282828] text-[11px] text-[#7c7c7c] font-mono">
              Industry Standard Formats
            </div>
          </Card>

          <Card className="p-6 flex flex-col justify-between bg-[#181818] border-[#282828] hover:border-[#383838]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#1ed760] font-bold">04</span>
                <Youtube className="w-4 h-4 text-[#b3b3b3]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                YouTube SEO & Thumbnail Canvas
              </h3>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Extract high-CTR video titles, chapter timestamps, and description tags from transcript text, then design 1280x720 thumbnails with Bengali typography.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#282828] text-[11px] text-[#7c7c7c] font-mono">
              Creator Studio Suite
            </div>
          </Card>
        </div>

        {/* Database & Cloud SQL Card */}
        <div className="mt-8 p-5 rounded-2xl bg-[#181818] border border-[#282828] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-white">
              Persistent PostgreSQL Cloud SQL Storage
            </div>
            <p className="text-xs text-[#b3b3b3] max-w-xl leading-relaxed">
              Every transcript, audio balance, and subscription tier is secured in Google Cloud SQL with automated schema migrations. Zero data leakage and isolated role-based authorization.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#b3b3b3] shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-[#1ed760]" />
            <span>asia-southeast1</span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. PRICING SECTION (QUIET CARDS & ZERO-LOUDNESS)          */}
      {/* ========================================================= */}
      <section id="pricing" className="max-w-4xl mx-auto px-4 pt-8 border-t border-[#282828]">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">
            Pricing & Plans
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
            Predictable, credit-based subscription tiers.
          </h2>
          <p className="text-sm text-[#b3b3b3] leading-relaxed">
            Every new account includes 30 free audio minutes. Upgrade as your production grows to unlock advanced export formats, YouTube SEO, and thumbnail creation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const isPro = plan.isPopular || plan.id === 'plan-pro';
            const priceLabel = plan.priceUsd === 0 ? '$0' : `$${plan.priceUsd}`;
            const bdtSubLabel =
              plan.priceBdt > 0 ? `৳${plan.priceBdt.toLocaleString()} BDT / mo` : 'Free forever';

            return (
              <Card
                key={plan.id}
                className={`p-6 flex flex-col justify-between transition-all bg-[#181818] ${
                  isPro
                    ? 'border-[#1ed760] shadow-[0_4px_24px_rgba(30,215,96,0.15)]'
                    : 'border-[#282828] hover:border-[#383838]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white">
                      {plan.name}
                    </h3>
                    <Badge variant={isPro ? 'default' : 'secondary'} className="font-mono text-xs">
                      {plan.creditsGranted} mins
                    </Badge>
                  </div>

                  <p className="text-xs text-[#b3b3b3] mb-5 min-h-[32px]">
                    {plan.description}
                  </p>

                  <div className="pb-4 border-b border-[#282828] mb-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold font-mono text-white">
                        {priceLabel}
                      </span>
                      <span className="text-xs text-[#b3b3b3]">/ month</span>
                    </div>
                    <div className="text-[11px] text-[#7c7c7c] font-mono mt-1">
                      {bdtSubLabel}
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="space-y-2 mb-8">
                    <div className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">
                      Capabilities:
                    </div>
                    <ul className="space-y-2 text-xs text-[#b3b3b3]">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-[#1ed760] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={handleSelectPlan}
                  disabled={Boolean(user?.planId && user.planId !== 'plan-free' && plan.priceUsd === 0)}
                  variant={isPro ? 'default' : 'outline'}
                  size="default"
                  className="w-full"
                >
                  {user?.planId && user.planId !== 'plan-free' && plan.priceUsd === 0
                    ? 'Active Paid Subscriber'
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
        <div className="mt-8 pt-5 border-t border-[#282828] flex flex-wrap items-center justify-between gap-4 text-xs text-[#b3b3b3]">
          <span>Supported Mobile Gateways: bKash (*247#), Nagad (*167#), and Rocket (*322#).</span>
          <span className="font-mono text-[#1ed760] text-[11px]">Idempotent Instant Quota Credit</span>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. CONTACT SECTION (REFINED PILL INPUTS & CLEAN LAYOUT)   */}
      {/* ========================================================= */}
      <section id="contact" className="max-w-4xl mx-auto px-4 pt-8 border-t border-[#282828]">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">
            Support & Inquiries
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
            Contact the engineering team.
          </h2>
          <p className="text-sm text-[#b3b3b3] leading-relaxed">
            Need custom high-volume quotas, API integration for newsrooms, or support with Bengali transcriptions? Send us a direct note.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Details Card */}
          <div className="lg:col-span-1 p-6 rounded-2xl bg-[#181818] border border-[#282828] flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-white">
                Direct Channels
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#b3b3b3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-[#b3b3b3]">Email Inquiries</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      support@banglascribe.com
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#b3b3b3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-[#b3b3b3]">Engineering Hub</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      Dhaka, Bangladesh
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#b3b3b3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-[#b3b3b3]">Response SLA</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      Within 24 Hours
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#282828] text-xs text-[#b3b3b3]">
              <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Enterprise Inquiries</span>
              </div>
              <p className="text-[11px] text-[#7c7c7c] leading-relaxed">
                For media houses and podcast networks requiring custom API throughput, contact us for tailored service level agreements.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 p-6 sm:p-7 rounded-2xl bg-[#181818] border border-[#282828]">
            {contactSubmitted ? (
              <div className="py-12 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-[#1ed760] mx-auto" />
                <h4 className="text-base font-bold text-white">
                  Message Sent Successfully
                </h4>
                <p className="text-xs text-[#b3b3b3] max-w-sm mx-auto leading-relaxed">
                  We have received your message and will reply to your provided email within one business day.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContactSubmitted(false)}
                  className="mt-2"
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#b3b3b3] block mb-1">
                      Your Name
                    </label>
                    <Input
                      type="text"
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value);
                        if (contactErrors.name) setContactErrors({ ...contactErrors, name: '' });
                      }}
                      placeholder="e.g. Tanvir Hossain"
                      className="text-xs"
                    />
                    {contactErrors.name && (
                      <p className="text-[11px] text-rose-400 mt-1">{contactErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-[#b3b3b3] block mb-1">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        if (contactErrors.email) setContactErrors({ ...contactErrors, email: '' });
                      }}
                      placeholder="tanvir@studio.com"
                      className="text-xs"
                    />
                    {contactErrors.email && (
                      <p className="text-[11px] text-rose-400 mt-1">{contactErrors.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#b3b3b3] block mb-1">
                    Topic
                  </label>
                  <Input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="e.g. Question about DOCX table exports"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#b3b3b3] block mb-1">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => {
                      setContactMessage(e.target.value);
                      if (contactErrors.message) setContactErrors({ ...contactErrors, message: '' });
                    }}
                    placeholder="Describe your audio production workflow or questions..."
                    className="w-full px-4 py-2.5 bg-[#1f1f1f] border border-[#282828] rounded-2xl text-xs text-white placeholder-[#7c7c7c] focus:outline-none focus:border-white transition-colors"
                  />
                  {contactErrors.message && (
                    <p className="text-[11px] text-rose-400 mt-1">{contactErrors.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSendingContact}
                  size="default"
                  className="flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingContact ? 'Sending...' : 'Send Inquiry'}</span>
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
