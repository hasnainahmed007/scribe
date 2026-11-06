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
  ShieldCheck,
  FileText,
  Scale,
  CreditCard,
  Lock,
  Sparkles,
  BookOpen,
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
      'Multilingual AI speech recognition (all languages)',
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
          <span>Multilingual Speech Intelligence</span>
          <span className="mx-2 text-[#4d4d4d]">·</span>
          <span>Subtitle Alignment</span>
          <span className="mx-2 text-[#4d4d4d]">·</span>
          <span>Creator Publishing Suite</span>
        </div>

        {/* Primary Headline: Restrained white heading */}
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.12] mb-6">
          Turn voice recordings in any language into accurate, synchronized subtitles.
        </h1>

        {/* Quiet Body Copy */}
        <p className="text-base sm:text-lg text-[#b3b3b3] max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          Powered by Gemini multimodal audio AI. Transcribe spoken audio across 100+ languages with timestamped precision, edit subtitle blocks with live audio sync, and export in SRT, DOCX, TXT, or JSON.
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
            Built for modern creators & multilingual workflows.
          </h2>
          <p className="text-sm text-[#b3b3b3] leading-relaxed">
            Conventional speech-to-text models struggle with diverse global accents, technical terminology, and multilingual code-switching. Scriby combines high-fidelity multimodal acoustic intelligence with an editorial subtitle toolset.
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
                Multilingual Speech Recognition
              </h3>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Universal script transcription supporting all major global languages with accurate punctuation, speaker separation, and natural code-switching.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#282828] text-[11px] text-[#7c7c7c] font-mono">
              100+ Global Languages
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
                Extract high-CTR video titles, chapter timestamps, and description tags from transcript text, then design 1280x720 thumbnails with striking typography.
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
            Need custom high-volume quotas, API integration for media teams, or transcription support? Send us a direct note.
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
                      support@scriby.com
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#b3b3b3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-[#b3b3b3]">Engineering Hub</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      Global Creator Cloud & APAC
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

      {/* ================= LANDING PAGE FOOTER ================= */}
      <footer className="mt-20 border-t border-[#282828] bg-[#0c0c0c] text-white">
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Col 1: Brand & Bio (2 cols wide) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1ed760] text-black flex items-center justify-center font-bold font-display shadow-lg shadow-[#1ed760]/20">
                  <Sparkles className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight text-white font-display">
                    Scriby
                  </span>
                  <span className="block text-[10px] text-[#7c7c7c] tracking-widest uppercase">
                    AI Speech Intelligence & Creator Studio
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#a7a7a7] leading-relaxed max-w-sm">
                Next-generation multilingual AI speech intelligence platform built for content creators, YouTube producers, podcasters, and media agencies. Transcribe audio across all languages with timestamped SRT subtitles, generate viral YouTube SEO metadata, and design 16:9 thumbnails effortlessly.
              </p>

              <div className="flex items-center gap-3 pt-2 text-xs text-[#7c7c7c]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-medium text-[11px]">PostgreSQL Cloud SQL Secured</span>
                </div>
                <span>•</span>
                <span className="text-[11px]">Universal Multilingual Support</span>
              </div>
            </div>

            {/* Col 2: Studio Tools */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                Studio Tools
              </h4>
              <ul className="space-y-2 text-xs text-[#a7a7a7]">
                <li>
                  <button
                    onClick={onGetStarted}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Multilingual Speech-to-Text
                  </button>
                </li>
                <li>
                  <button
                    onClick={onGetStarted}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    SRT & TXT Subtitle Editor
                  </button>
                </li>
                <li>
                  <button
                    onClick={onGetStarted}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    16:9 Thumbnail Studio
                  </button>
                </li>
                <li>
                  <button
                    onClick={onGetStarted}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    YouTube SEO & Chapters AI
                  </button>
                </li>
                <li>
                  <button
                    onClick={onGetStarted}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Browser Voice Recorder
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
                    className="text-[#a7a7a7] hover:text-[#1ed760] transition-colors flex items-center gap-2 group cursor-pointer text-left"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#7c7c7c] group-hover:text-[#1ed760] transition-colors" />
                    <span className="font-medium text-slate-300 group-hover:text-white">Terms and Conditions</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenPolicy('privacy')}
                    className="text-[#a7a7a7] hover:text-[#1ed760] transition-colors flex items-center gap-2 group cursor-pointer text-left"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#7c7c7c] group-hover:text-[#1ed760] transition-colors" />
                    <span className="font-medium text-slate-300 group-hover:text-white">Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenPolicy('refund')}
                    className="text-[#a7a7a7] hover:text-[#1ed760] transition-colors flex items-center gap-2 group cursor-pointer text-left"
                  >
                    <Scale className="w-3.5 h-3.5 text-[#7c7c7c] group-hover:text-[#1ed760] transition-colors" />
                    <span className="font-medium text-slate-300 group-hover:text-white">Refund Policy</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Payment */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Payment</span>
              </h4>
              <p className="text-[11px] text-[#7c7c7c] leading-relaxed">
                Instant activation supported via mobile financial services:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* bKash */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#e2136e]/15 text-[#ff4b8e] border border-[#e2136e]/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff4b8e]" />
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2L4.5 9.5l3.8 1.4L3 15l6.5 1.2L7.5 22 15 15.5l-3.8-1.4L17 10z"/>
                  </svg>
                  <span>bKash</span>
                </div>

                {/* Nagad */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#f7941d]/15 text-[#ffa726] border border-[#f7941d]/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffa726]" />
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H8l5-7v4h3l-5 7z"/>
                  </svg>
                  <span>Nagad</span>
                </div>

                {/* Rocket */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#8c3494]/15 text-[#c084fc] border border-[#8c3494]/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M13.13 2.18c-.37-.53-1.12-.53-1.49 0L7.4 8.24C6.91 8.94 7.41 9.9 8.27 9.9h1.96V18c0 .55.45 1 1 1h1.54c.55 0 1-.45 1-1V9.9h1.96c.86 0 1.36-.96.87-1.66l-4.24-6.06zM5 19c0-.55.45-1 1-1h12c.55 0 1 .45 1 1s-.45 1-1 1H6c-.55 0-1-.45-1-1z"/>
                  </svg>
                  <span>Rocket</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-[11px] text-[#7c7c7c]">
                <Lock className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>256-Bit SSL Encrypted & OTP Protected</span>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="mt-12 pt-8 border-t border-[#1f1f1f] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7c7c7c]">
            <div className="flex items-center gap-2">
              <span>© {new Date().getFullYear()} Scriby. All rights reserved.</span>
              <span>•</span>
              <span className="text-[#a7a7a7]">Made with ❤️ for Global Creators</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
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
