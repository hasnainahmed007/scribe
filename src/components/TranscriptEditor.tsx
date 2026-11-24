import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Merge,
  Search,
  Replace,
  User,
  Check,
  Volume2,
  Combine,
  RotateCcw,
  X,
  FileAudio,
  Loader2,
  Mic,
  MessageSquareText,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { formatPlayerTime } from '../utils/timeFormat';
import type { ChatSttActivity } from './AudioInputHub';

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  summary: string;
  audioName?: string;
  currentTime: number;
  isTranscribing?: boolean;
  chatActivity?: ChatSttActivity | null;
  onCancelTranscription?: () => void;
  composerFooter?: React.ReactNode;
  onUpdateSegment: (id: string, updated: Partial<TranscriptSegment>) => void;
  onDeleteSegment: (id: string) => void;
  onAddSegment: (afterId?: string) => void;
  onMergeSegments: (firstId: string) => void;
  onMergeAllSegments?: () => void;
  onUndoMergeAll?: () => void;
  canUndoMergeAll?: boolean;
  onSplitSegment: (id: string, splitIndex: number) => void;
  onSeek: (seconds: number) => void;
  onPlaySegment?: (start: number, end: number, id: string) => void;
  onSearchReplace: (searchTerm: string, replaceTerm: string) => number;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  segments,
  summary,
  audioName,
  currentTime,
  isTranscribing = false,
  chatActivity = null,
  onCancelTranscription,
  composerFooter,
  onUpdateSegment,
  onDeleteSegment,
  onAddSegment,
  onMergeSegments,
  onMergeAllSegments,
  onUndoMergeAll,
  canUndoMergeAll = false,
  onSeek,
  onPlaySegment,
  onSearchReplace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [replaceCount, setReplaceCount] = useState<number | null>(null);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerInputValue, setSpeakerInputValue] = useState('');
  const [showSummary, setShowSummary] = useState(true);
  const [showMergeAllConfirm, setShowMergeAllConfirm] = useState(false);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat feed when streaming blocks or live mic activity updates
  useEffect(() => {
    if (!chatScrollRef.current) return;
    if (isTranscribing || chatActivity?.status === 'recording') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [segments.length, isTranscribing, chatActivity?.status, chatActivity?.livePartialText, chatActivity?.liveCommittedLines?.length]);

  // Clear undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // When canUndoMergeAll becomes false (e.g. user already clicked undo), hide banner
  useEffect(() => {
    if (!canUndoMergeAll) {
      setShowUndoBanner(false);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    }
  }, [canUndoMergeAll]);

  const handleExecuteMergeAll = () => {
    if (onMergeAllSegments) {
      onMergeAllSegments();
    }
    setShowMergeAllConfirm(false);
    setShowUndoBanner(true);

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    // Auto-dismiss after 5 seconds
    undoTimerRef.current = setTimeout(() => {
      setShowUndoBanner(false);
    }, 5000);
  };

  const handleDismissUndoAlert = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setShowUndoBanner(false);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setShowUndoBanner(false);
    if (onUndoMergeAll) {
      onUndoMergeAll();
    }
  };

  // Text-To-Speech (TTS) State
  const [speakingSegmentId, setSpeakingSegmentId] = useState<string | null>(null);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-To-Speech Bengali Voice Synthesizer
  const handleSpeakText = (id: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (speakingSegmentId === id) {
      window.speechSynthesis.cancel();
      setSpeakingSegmentId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    // Universal script & language detection
    const isBengali = /[\u0980-\u09FF]/.test(text);
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const isDevanagari = /[\u0900-\u097F]/.test(text);
    const isKorean = /[\uAC00-\uD7AF]/.test(text);
    const isJapanese = /[\u3040-\u30FF]/.test(text);
    const isChinese = /[\u4E00-\u9FFF]/.test(text);
    const isCyrillic = /[\u0400-\u04FF]/.test(text);
    const isSpanish = /[áéíóúüñ¿¡]/i.test(text);
    const isFrench = /[àâçèéêëîïôùûüÿœæ]/i.test(text);
    const isGerman = /[äöüß]/i.test(text);

    if (isBengali) {
      utterance.lang = 'bn-BD';
      const bnVoice = voices.find((v) => v.lang.startsWith('bn') || v.name.toLowerCase().includes('bengali'));
      if (bnVoice) utterance.voice = bnVoice;
    } else if (isArabic) {
      utterance.lang = 'ar-SA';
      const arVoice = voices.find((v) => v.lang.startsWith('ar'));
      if (arVoice) utterance.voice = arVoice;
    } else if (isDevanagari) {
      utterance.lang = 'hi-IN';
      const hiVoice = voices.find((v) => v.lang.startsWith('hi'));
      if (hiVoice) utterance.voice = hiVoice;
    } else if (isKorean) {
      utterance.lang = 'ko-KR';
      const koVoice = voices.find((v) => v.lang.startsWith('ko'));
      if (koVoice) utterance.voice = koVoice;
    } else if (isJapanese) {
      utterance.lang = 'ja-JP';
      const jaVoice = voices.find((v) => v.lang.startsWith('ja'));
      if (jaVoice) utterance.voice = jaVoice;
    } else if (isChinese) {
      utterance.lang = 'zh-CN';
      const zhVoice = voices.find((v) => v.lang.startsWith('zh'));
      if (zhVoice) utterance.voice = zhVoice;
    } else if (isCyrillic) {
      utterance.lang = 'ru-RU';
      const ruVoice = voices.find((v) => v.lang.startsWith('ru'));
      if (ruVoice) utterance.voice = ruVoice;
    } else if (isSpanish) {
      utterance.lang = 'es-ES';
      const esVoice = voices.find((v) => v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;
    } else if (isFrench) {
      utterance.lang = 'fr-FR';
      const frVoice = voices.find((v) => v.lang.startsWith('fr'));
      if (frVoice) utterance.voice = frVoice;
    } else if (isGerman) {
      utterance.lang = 'de-DE';
      const deVoice = voices.find((v) => v.lang.startsWith('de'));
      if (deVoice) utterance.voice = deVoice;
    } else {
      utterance.lang = 'en-US';
      const enVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('English')));
      if (enVoice) utterance.voice = enVoice;
    }
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingSegmentId(null);
    utterance.onerror = () => setSpeakingSegmentId(null);

    setSpeakingSegmentId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Play audio segment
  const handlePlayBlockAudio = (seg: TranscriptSegment) => {
    if (onPlaySegment) {
      onPlaySegment(seg.start, seg.end, seg.id);
    } else {
      onSeek(seg.start);
    }
  };

  // Execute Replace All
  const handleExecuteReplace = () => {
    if (!searchTerm.trim()) return;
    const count = onSearchReplace(searchTerm, replaceTerm);
    setReplaceCount(count);
    setTimeout(() => setReplaceCount(null), 3000);
  };

  // Speaker Rename
  const handleSaveSpeaker = (id: string) => {
    if (speakerInputValue.trim()) {
      onUpdateSegment(id, { speaker: speakerInputValue.trim() });
    }
    setEditingSpeakerId(null);
  };

  const totalWords = segments.reduce(
    (sum, seg) => sum + (seg.text ? seg.text.trim().split(/\s+/).length : 0),
    0
  );
  const lastSegmentEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const estimatedWpm = lastSegmentEnd > 0 ? Math.round((totalWords / lastSegmentEnd) * 60) : 0;
  const uniqueSpeakers = Array.from(
    new Set(segments.map((s) => (s.speaker || 'Speaker 1').trim()).filter(Boolean))
  );

  return (
    <div className="space-y-4">
      {/* Editor Statistics & Global Search Toolbar */}
      <div className="bg-[#181818] border border-[#282828] rounded-xl p-4 shadow-[0_6px_18px_rgba(0,0,0,0.35)] space-y-3.5">
        {/* Metadata Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#282828] text-xs text-[#9ca3af]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[#d0d5dd] font-semibold">
              Segments: <span className="font-mono text-[#3fb970] font-semibold tabular-nums">{segments.length}</span>
            </span>
            <span className="text-[#4a4e57]">·</span>
            <span>
              Speakers: <span className="font-mono text-[#d0d5dd] tabular-nums">{Math.max(1, uniqueSpeakers.length)}</span>
            </span>
            <span className="text-[#4a4e57]">·</span>
            <span>
              Words: <span className="font-mono text-[#d0d5dd] tabular-nums">{totalWords}</span>
            </span>
            <span className="text-[#4a4e57]">·</span>
            <span>
              Pacing: <span className="font-mono text-[#d0d5dd] tabular-nums">{estimatedWpm}</span> wpm
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Merge All Segments Button with Rich Tooltip */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  if (segments.length > 1) {
                    setShowMergeAllConfirm(true);
                  }
                }}
                disabled={segments.length <= 1}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] disabled:opacity-40 disabled:cursor-not-allowed text-[#d0d5dd] rounded-full text-xs font-semibold border border-[#34373f] transition-all cursor-pointer shadow-sm"
                title={
                  segments.length > 1
                    ? `Merge all ${segments.length} subtitle segments into 1 continuous block`
                    : 'Requires at least 2 subtitle segments to merge'
                }
                aria-label="Merge all subtitle segments"
              >
                <Combine className="w-3.5 h-3.5 text-[#34a866]" />
                <span>Merge All</span>
                {segments.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#2a2d33] text-xs text-[#9ca3af] font-mono tabular-nums leading-none">
                    {segments.length}
                  </span>
                )}
              </button>

              {/* Styled Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 transition-all opacity-0 group-hover:opacity-100 duration-200">
                <div className="bg-[#121212] text-[#d0d5dd] text-xs font-medium px-3 py-1.5 rounded-lg border border-[#34373f] shadow-[0_8px_24px_rgba(0,0,0,0.85)] whitespace-nowrap flex items-center gap-1.5">
                  <Combine className="w-3 h-3 text-[#34a866] shrink-0" />
                  <span>
                    {segments.length > 1
                      ? `Merge all ${segments.length} segments into 1 continuous subtitle block`
                      : 'Requires at least 2 segments to merge'}
                  </span>
                </div>
                <div className="w-2 h-2 bg-[#121212] border-r border-b border-[#34373f] rotate-45 -mt-1" />
              </div>
            </div>

            {/* Add Subtitle Block Button */}
            <button
              onClick={() => onAddSegment()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] text-[#d0d5dd] rounded-full text-xs font-semibold border border-[#34373f] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#34a866]" />
              <span>Add Subtitle Block</span>
            </button>
          </div>
        </div>

        {/* Global Search and Replace */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#6f7682] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find spoken words or phrases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#1a1c20] border border-[#2e3138] rounded-full text-xs text-[#d0d5dd] placeholder-[#6f7682] focus:outline-none focus:border-[#1db954]/55 transition-colors font-sans"
            />
          </div>

          <div className="relative flex-1">
            <Replace className="w-3.5 h-3.5 text-[#6f7682] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#1a1c20] border border-[#2e3138] rounded-full text-xs text-[#d0d5dd] placeholder-[#6f7682] focus:outline-none focus:border-[#1db954]/55 transition-colors font-sans"
            />
          </div>

          <button
            onClick={handleExecuteReplace}
            disabled={!searchTerm.trim()}
            className="px-5 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] disabled:opacity-40 text-[#08100b] text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer shrink-0"
          >
            Replace All
          </button>

          {replaceCount !== null && (
            <span className="text-xs font-mono text-[#3fb970] self-center">
              {replaceCount} replaced
            </span>
          )}
        </div>
      </div>

      {/* Merge All Confirmation Prompt */}
      {showMergeAllConfirm && (
        <div className="p-3.5 bg-[#181818] border border-[#34373f] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[#d0d5dd] shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#3fb970] shrink-0">
              <Combine className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-[#e4e7ec]">Merge all {segments.length} subtitle segments?</div>
              <div className="text-xs text-[#9ca3af]">
                This combines all {segments.length} blocks into 1 continuous segment from{' '}
                <span className="font-mono text-[#d0d5dd]">{formatPlayerTime(segments[0]?.start ?? 0)}</span> to{' '}
                <span className="font-mono text-[#d0d5dd]">{formatPlayerTime(segments[segments.length - 1]?.end ?? 0)}</span>. You can undo this action anytime.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMergeAllConfirm(false)}
              className="px-3 py-1.5 text-xs text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteMergeAll}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold text-xs rounded-full cursor-pointer transition-colors shadow-sm"
            >
              <Combine className="w-3.5 h-3.5" />
              <span>Yes, Merge All</span>
            </button>
          </div>
        </div>
      )}

      {/* Undo Merge Notification Banner */}
      {showUndoBanner && canUndoMergeAll && onUndoMergeAll && !showMergeAllConfirm && (
        <div className="p-3 bg-[#16201a] border border-[#1db954]/30 rounded-xl flex items-center justify-between gap-3 text-xs text-[#d0d5dd] shadow-lg animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#3fb970] shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[#d0d5dd] font-medium">
                All subtitle segments have been merged into 1 continuous block.
              </span>
              <span className="hidden sm:inline-block text-xs text-[#6f7682] ml-2 font-mono tabular-nums">
                (auto-closes in 5s)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-semibold rounded-full cursor-pointer transition-colors shrink-0 shadow-sm"
              title="Restore original separated subtitle segments"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Merge</span>
            </button>
            <button
              type="button"
              onClick={handleDismissUndoAlert}
              className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
              title="Close notification"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Summary Accordion Strip — only shown when transcription is ready */}
      {summary && !isTranscribing && segments.length > 0 && (
        <div className="p-4 rounded-xl bg-[#181818] border border-[#282828] text-xs text-[#c2c8d1]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#9ca3af] font-semibold uppercase tracking-wider text-xs">
              Audio Synopsis
            </span>
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="text-[#9ca3af] hover:text-[#e4e7ec] text-xs cursor-pointer"
            >
              {showSummary ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {showSummary && <p className="text-[#c2c8d1] leading-relaxed text-sm">{summary}</p>}
        </div>
      )}

      {/* Chat-Style Transcript Container (Scrollable Blocks + Bottom Audio Input Composer) */}
      <div className="bg-[#141414] border border-[#282828] rounded-xl flex flex-col overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        {/* Chat Stream Header */}
        <div className="px-4 py-2.5 bg-[#181818] border-b border-[#282828] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-[#9ca3af]">
            <MessageSquareText className="w-3.5 h-3.5 text-[#3fb970] shrink-0" />
            <span className="font-semibold text-[#e4e7ec] whitespace-nowrap">Transcript Chat</span>
            {(chatActivity?.sourceLabel || audioName) && (
              <>
                <span className="text-[#4a4e57]">·</span>
                <span className="truncate text-[#9ca3af]">{chatActivity?.sourceLabel || audioName}</span>
              </>
            )}
          </div>
          <span className="font-mono tabular-nums text-[11px] text-[#6f7682] whitespace-nowrap shrink-0">
            {isTranscribing
              ? `Streaming · ${segments.length} ready`
              : segments.length > 0
              ? `${segments.length} blocks`
              : 'Ready'}
          </span>
        </div>

        {/* Scrollable Chat Messages / Subtitle Blocks Viewport */}
        <div
          ref={chatScrollRef}
          className="max-h-[540px] min-h-[240px] overflow-y-auto p-4 space-y-3.5 scroll-smooth"
        >
          {/* User Audio Prompt Message Bubble */}
          {(chatActivity || (segments.length > 0 && audioName)) && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#19281f] border border-[#1db954]/30 px-4 py-2.5 text-xs text-[#e4e7ec] flex items-center gap-2.5 shadow-sm">
                <div className="w-6 h-6 rounded-full bg-[#1db954]/20 text-[#3fb970] flex items-center justify-center shrink-0">
                  {chatActivity?.sourceType === 'record' ? (
                    <Mic className="w-3.5 h-3.5" />
                  ) : (
                    <FileAudio className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#e4e7ec] truncate">
                    {chatActivity?.sourceLabel || audioName}
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {chatActivity?.status === 'recording'
                      ? 'Live microphone stream'
                      : chatActivity?.status === 'processing'
                      ? 'Transcribing locally with Moonshine WASM'
                      : 'Audio transcribed into speaker blocks'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty Welcome Chat State */}
          {segments.length === 0 && !chatActivity && (
            <div className="py-10 text-center space-y-2.5">
              <div className="w-11 h-11 rounded-full bg-[#1f1f1f] border border-[#2e3138] text-[#3fb970] flex items-center justify-center mx-auto">
                <FileAudio className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-[#e4e7ec] font-display">
                Start a Transcription Conversation
              </h4>
              <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
                Upload an audio/video file or start your microphone in the chat bar below. Completed speaker blocks will appear here as they are ready.
              </p>
            </div>
          )}

          {/* Assistant Subtitle Blocks (Existing Card Design Inside Chat Stream Outer Layout) */}
          {segments.map((seg, index) => {
            const isActive = currentTime >= seg.start && currentTime <= seg.end;
            const isSpeaking = speakingSegmentId === seg.id;
            const spName = seg.speaker || 'Speaker 1';
            const spIdx = Math.max(0, uniqueSpeakers.indexOf(spName));
            const speakerBadgeNum = spIdx + 1;
            const avatarColorClass =
              spIdx === 1
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                : spIdx === 2
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : spIdx >= 3
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                : 'bg-[#1db954]/15 text-[#4cc37c] border-[#1db954]/35';

            return (
              <div key={seg.id} className="flex items-start gap-2.5">
                {/* Chat Participant Avatar */}
                <div
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-mono font-bold shrink-0 mt-1 ${avatarColorClass}`}
                  title={spName}
                >
                  S{speakerBadgeNum}
                </div>

                {/* Unchanged Internal Block Design inside Chat Message Bubble */}
                <div
                  className={`flex-1 min-w-0 p-4 rounded-2xl rounded-tl-sm border transition-all ${
                    isActive
                      ? 'bg-[#1d221f] border-[#1db954]/55'
                      : 'bg-[#181818] border-[#282828] hover:border-[#34373f]'
                  }`}
                >
                  {/* Segment Metadata & Actions Header */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-mono tabular-nums text-[#6f7682]">
                        #{index + 1}
                      </span>

                      {/* Play Audio Block Timestamp Button */}
                      <button
                        onClick={() => handlePlayBlockAudio(seg)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#121212] hover:bg-[#262930] rounded-full text-xs font-mono tabular-nums text-[#d0d5dd] border border-[#2e3138] transition-all cursor-pointer"
                        title="Play audio from this timestamp"
                      >
                        <Play className="w-3 h-3 fill-current text-[#34a866]" />
                        <span>
                          {formatPlayerTime(seg.start)} – {formatPlayerTime(seg.end)}
                        </span>
                      </button>

                      {/* Dedicated Text-To-Speech (TTS) Voice Button */}
                      <button
                        onClick={() => handleSpeakText(seg.id, seg.text)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSpeaking
                            ? 'bg-[#262930] text-[#3fb970] border-[#1db954]/50'
                            : 'bg-[#121212] hover:bg-[#262930] text-[#9ca3af] hover:text-[#e4e7ec] border-[#2e3138]'
                        }`}
                        title={isSpeaking ? 'Stop speaking' : 'Read text aloud (Text-to-Speech)'}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'text-[#3fb970]' : 'text-[#9ca3af]'}`} />
                        <span className="text-xs font-semibold">
                          {isSpeaking ? 'Reading...' : 'TTS'}
                        </span>
                      </button>

                      {/* Speaker Label */}
                      {editingSpeakerId === seg.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={speakerInputValue}
                            onChange={(e) => setSpeakerInputValue(e.target.value)}
                            className="px-2.5 py-0.5 bg-[#121212] border border-[#34373f] rounded-full text-xs text-[#d0d5dd] w-28 focus:outline-none focus:border-[#1db954]/55"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveSpeaker(seg.id);
                            }}
                          />
                          <button
                            onClick={() => handleSaveSpeaker(seg.id)}
                            className="p-1 text-[#3fb970] hover:bg-[#282828] rounded-full cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        (() => {
                          const speakerToneClass =
                            spIdx === 1
                              ? 'bg-sky-500/12 text-sky-300 border-sky-500/30 hover:bg-sky-500/20'
                              : spIdx === 2
                              ? 'bg-amber-500/12 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                              : spIdx >= 3
                              ? 'bg-rose-500/12 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                              : 'bg-[#121212] hover:bg-[#262930] text-[#c2c8d1] border-[#2e3138]';
                          return (
                            <button
                              onClick={() => {
                                setEditingSpeakerId(seg.id);
                                setSpeakerInputValue(spName);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${speakerToneClass}`}
                              title="Click to rename speaker"
                            >
                              <User className="w-3 h-3 opacity-80" />
                              <span>{spName}</span>
                            </button>
                          );
                        })()
                      )}
                    </div>

                    {/* Subtitle Action Tools */}
                    <div className="flex items-center gap-1 text-[#9ca3af]">
                      {index < segments.length - 1 && (
                        <button
                          onClick={() => onMergeSegments(seg.id)}
                          className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#282828] rounded-md transition-colors cursor-pointer"
                          title="Merge with next block"
                        >
                          <Merge className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onAddSegment(seg.id)}
                        className="p-1.5 text-[#9ca3af] hover:text-[#3fb970] hover:bg-[#282828] rounded-md transition-colors cursor-pointer"
                        title="Insert block below"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSegment(seg.id)}
                        className="p-1.5 text-[#6f7682] hover:text-rose-400 hover:bg-[#282828] rounded-md transition-colors cursor-pointer"
                        title="Delete block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Subtitle Editable Content */}
                  <textarea
                    value={seg.text}
                    onChange={(e) => onUpdateSegment(seg.id, { text: e.target.value })}
                    rows={2}
                    className="w-full bg-transparent border-0 text-sm text-[#d0d5dd] leading-relaxed focus:outline-none focus:bg-[#121212]/80 p-2 rounded-lg resize-y transition-colors"
                    placeholder="Type subtitle segment text..."
                  />
                </div>
              </div>
            );
          })}

          {/* Assistant Live Progress / Recording Bubble */}
          {chatActivity && (chatActivity.status === 'processing' || chatActivity.status === 'recording') && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1db954]/15 border border-[#1db954]/35 text-[#3fb970] flex items-center justify-center shrink-0 mt-1">
                {chatActivity.status === 'recording' ? (
                  <Mic className="w-3.5 h-3.5" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
              </div>

              <div className="flex-1 min-w-0 p-3.5 rounded-2xl rounded-tl-sm bg-[#181818] border border-[#2e3138] space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#e4e7ec]">
                    {chatActivity.status === 'recording'
                      ? `Live Microphone (${formatPlayerTime(chatActivity.recordingSeconds || 0)})`
                      : chatActivity.loadingStep || 'Transcribing audio...'}
                  </span>
                  {chatActivity.status === 'processing' && onCancelTranscription && (
                    <button
                      type="button"
                      onClick={onCancelTranscription}
                      className="px-2.5 py-1 bg-[#202020] hover:bg-[#2a2a2a] text-[#d0d5dd] rounded-md border border-[#323232] text-[11px] font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {chatActivity.downloadProgress &&
                  chatActivity.downloadProgress.fraction >= 0 &&
                  chatActivity.downloadProgress.fraction < 1 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#9ca3af]">
                        <span className="truncate max-w-[220px]">Caching {chatActivity.downloadProgress.file}</span>
                        <span>{Math.round(chatActivity.downloadProgress.fraction * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#242424] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1db954] transition-all duration-150"
                          style={{ width: `${Math.round(chatActivity.downloadProgress.fraction * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                {chatActivity.chunkProgress && chatActivity.chunkProgress.totalChunks > 1 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#9ca3af]">
                      <span>
                        Segment {chatActivity.chunkProgress.currentChunk} of {chatActivity.chunkProgress.totalChunks}
                      </span>
                      <span>
                        {formatPlayerTime(chatActivity.chunkProgress.processedSeconds)} /{' '}
                        {formatPlayerTime(chatActivity.chunkProgress.totalSeconds)} ·{' '}
                        {Math.round(chatActivity.chunkProgress.fraction * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#242424] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1db954] transition-all duration-150"
                        style={{ width: `${Math.max(3, Math.round(chatActivity.chunkProgress.fraction * 100))}%` }}
                      />
                    </div>
                    {chatActivity.chunkProgress.autoSwitchNotice && (
                      <p className="text-[11px] text-[#9ca3af]">
                        {chatActivity.chunkProgress.autoSwitchNotice}
                      </p>
                    )}
                  </div>
                )}

                {chatActivity.status === 'recording' &&
                  ((chatActivity.liveCommittedLines && chatActivity.liveCommittedLines.length > 0) ||
                    chatActivity.livePartialText) && (
                    <div className="p-2.5 rounded-lg bg-[#121212] border border-[#282828] space-y-1 max-h-32 overflow-y-auto text-xs">
                      {chatActivity.liveCommittedLines?.map((line) => (
                        <p key={line.id} className="text-[#e4e7ec]">
                          <span className="font-mono tabular-nums text-[#3fb970] mr-2">
                            {formatPlayerTime(Math.floor(line.startTime))}
                          </span>
                          {line.text}
                        </p>
                      ))}
                      {chatActivity.livePartialText && (
                        <p className="text-[#9ca3af] italic">{chatActivity.livePartialText}</p>
                      )}
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Chat Input Composer */}
        {composerFooter}
      </div>
    </div>
  );
};
