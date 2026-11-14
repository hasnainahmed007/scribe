import React, { useState } from 'react';
import {
  X,
  Mic,
  FileAudio,
  Download,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Play,
  Keyboard,
  Youtube,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTranscribing: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartTranscribing,
}) => {
  const [step, setStep] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="bg-[#181818] border border-[#282828] rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col"
      >
        {/* Top Bar with Step Indicators */}
        <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#1ed760] text-black font-extrabold text-xs flex items-center justify-center">
              {step}
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Step {step} of 3
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Content */}
        <div className="p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center mb-2">
                <Mic className="w-6 h-6" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold text-white tracking-tight">
                1. Upload or Record Spoken Audio
              </h2>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Scriby delivers state-of-the-art speech intelligence across 100+ global languages with accurate punctuation, timestamps, and speaker recognition. Upload MP3/WAV/M4A files or record directly from your microphone.
              </p>

              <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#282828] space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>30 Free Audio Minutes Included</span>
                </div>
                <p className="text-xs text-[#b3b3b3] leading-relaxed">
                  Start testing immediately using your complimentary starter quota or try our preloaded demo tracks.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center mb-2">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold text-white tracking-tight">
                2. Live Synchronized Subtitle Editing
              </h2>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Click any subtitle block to jump the audio player instantly to that exact moment. Use keyboard shortcuts like <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#121212] text-white rounded border border-[#383838]">Space</kbd> for play/pause and <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#121212] text-white rounded border border-[#383838]">Ctrl+Enter</kbd> to split segments.
              </p>

              <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#282828] space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Editorial Hotkeys</span>
                </div>
                <p className="text-xs text-[#b3b3b3] leading-relaxed">
                  Rapidly proofread text, adjust start/end timestamps to the millisecond, and merge adjacent phrases.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center mb-2">
                <Download className="w-6 h-6" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold text-white tracking-tight">
                3. Export Everywhere & Optimize for YouTube
              </h2>
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Export standard SubRip (.srt) for YouTube and premiere video editing tools, or download formatted Word documents (.docx) and plain text for transcripts.
              </p>

              <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#282828] space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Youtube className="w-3.5 h-3.5 text-rose-400" />
                  <span>YouTube SEO & 16:9 Thumbnail Studio</span>
                </div>
                <p className="text-xs text-[#b3b3b3] leading-relaxed">
                  Automatically generate high-CTR video titles, descriptions, chapters, and hashtags, and design matching 16:9 thumbnails.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-[#121212] border-t border-[#282828] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="text-xs text-[#b3b3b3] hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#b3b3b3] hover:text-white cursor-pointer"
            >
              Skip Tour
            </button>
          )}

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onStartTranscribing();
                }}
              >
                <span>Launch Studio</span>
                <Check className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
