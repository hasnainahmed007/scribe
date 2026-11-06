import React, { useState, useEffect } from 'react';
import { X, FileText, Shield, RotateCcw, CheckCircle2, Clock, Printer } from 'lucide-react';
import { PlatformPolicy, PolicySlug } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlug?: PolicySlug;
}

const FALLBACK_POLICIES: Record<PolicySlug, { title: string; content: string }> = {
  terms: {
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
  },
  privacy: {
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
  },
  refund: {
    title: 'Refund Policy',
    content: `# Scriby — Refund and Cancellation Policy
Last Updated: November 2026

Our mission is to provide global content creators with the most reliable, accurate, and high-performance multilingual speech intelligence tools. We believe in fair, transparent billing and customer satisfaction.

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
  },
};

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  initialSlug = 'terms',
}) => {
  const [activeSlug, setActiveSlug] = useState<PolicySlug>(initialSlug);
  const [policies, setPolicies] = useState<Record<PolicySlug, PlatformPolicy | { title: string; content: string }>>(
    FALLBACK_POLICIES
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setActiveSlug(initialSlug);
  }, [initialSlug]);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    safeFetchJson<{ success: boolean; data: PlatformPolicy[] }>('/api/policies')
      .then((res) => {
        if (res.ok && res.data?.data && res.data.data.length > 0) {
          const map: any = { ...FALLBACK_POLICIES };
          for (const p of res.data.data) {
            map[p.slug] = p;
          }
          setPolicies(map);
        }
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPolicy = policies[activeSlug] || FALLBACK_POLICIES[activeSlug];

  // Simple Markdown renderer for policy text
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={index} className="text-xl sm:text-2xl font-bold text-white mt-4 mb-3 font-display border-b border-[#282828] pb-2">
            {trimmed.replace('# ', '')}
          </h1>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={index} className="text-sm sm:text-base font-bold text-emerald-400 mt-5 mb-2 font-display flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={index} className="text-base sm:text-lg font-bold text-white mt-5 mb-2 font-display">
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('- ')) {
        const itemText = trimmed.replace('- ', '');
        return (
          <li key={index} className="text-xs sm:text-sm text-slate-300 ml-4 mb-1 list-disc leading-relaxed">
            {renderInlineMarkdown(itemText)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <li key={index} className="text-xs sm:text-sm text-slate-300 ml-4 mb-1 list-decimal leading-relaxed">
            {renderInlineMarkdown(trimmed.replace(/^\d+\.\s/, ''))}
          </li>
        );
      }
      if (!trimmed) {
        return <div key={index} className="h-2" />;
      }
      return (
        <p key={index} className="text-xs sm:text-sm text-slate-300 mb-2 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#121212] border border-[#282828] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header with Navigation Pills */}
        <div className="p-4 sm:p-5 border-b border-[#282828] bg-[#181818]/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#121212] rounded-full border border-[#282828] overflow-x-auto">
            <button
              onClick={() => setActiveSlug('terms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeSlug === 'terms'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Terms & Conditions</span>
            </button>

            <button
              onClick={() => setActiveSlug('privacy')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeSlug === 'privacy'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Privacy Policy</span>
            </button>

            <button
              onClick={() => setActiveSlug('refund')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeSlug === 'refund'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Refund Policy</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer hidden sm:block"
              title="Print Policy"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body with Cloud SQL Badge & Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 text-[11px] text-slate-400 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Scriby SaaS Legal Document</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              <span>Stored in PostgreSQL Database</span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Loading policy details from database...
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              {renderFormattedContent(currentPolicy.content)}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#282828] bg-[#181818]/60 flex items-center justify-between text-xs text-slate-400">
          <span>Scriby · Official Creator Terms & Policies</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
