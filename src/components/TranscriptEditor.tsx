import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Merge,
  User,
  Check,
  Volume2,
  FileAudio,
  Loader2,
  Mic,
  Terminal,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { formatPlayerTime } from '../utils/timeFormat';
import type { ChatSttActivity } from './AudioInputHub';

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  audioName?: string;
  audioTitle?: string;
  userName?: string;
  currentTime: number;
  isTranscribing?: boolean;
  chatActivity?: ChatSttActivity | null;
  onCancelTranscription?: () => void;
  composerFooter?: React.ReactNode;
  onUpdateSegment: (id: string, updated: Partial<TranscriptSegment>) => void;
  onDeleteSegment: (id: string) => void;
  onAddSegment: (afterId?: string) => void;
  onMergeSegments: (firstId: string) => void;
  onSeek: (seconds: number) => void;
  onPlaySegment?: (start: number, end: number, id: string) => void;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  segments,
  audioName,
  audioTitle,
  userName,
  currentTime,
  isTranscribing = false,
  chatActivity = null,
  onCancelTranscription,
  composerFooter,
  onUpdateSegment,
  onDeleteSegment,
  onAddSegment,
  onMergeSegments,
  onSeek,
  onPlaySegment,
}) => {
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerInputValue, setSpeakerInputValue] = useState('');
  const [speakingSegmentId, setSpeakingSegmentId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll inference thread when streaming blocks or live mic activity updates
  useEffect(() => {
    if (!chatScrollRef.current) return;
    if (isTranscribing || chatActivity?.status === 'recording') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [
    segments.length,
    isTranscribing,
    chatActivity?.status,
    chatActivity?.livePartialText,
    chatActivity?.liveCommittedLines?.length,
  ]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-To-Speech Voice Synthesizer
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
      const enVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('English'))
      );
      if (enVoice) utterance.voice = enVoice;
    }
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingSegmentId(null);
    utterance.onerror = () => setSpeakingSegmentId(null);

    setSpeakingSegmentId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayBlockAudio = (seg: TranscriptSegment) => {
    if (onPlaySegment) {
      onPlaySegment(seg.start, seg.end, seg.id);
    } else {
      onSeek(seg.start);
    }
  };

  const handleSaveSpeaker = (id: string) => {
    if (speakerInputValue.trim()) {
      onUpdateSegment(id, { speaker: speakerInputValue.trim() });
    }
    setEditingSpeakerId(null);
  };

  const uniqueSpeakers = Array.from(
    new Set(segments.map((s) => (s.speaker || 'Speaker 1').trim()).filter(Boolean))
  );

  const hasLiveTrace = Boolean(
    chatActivity && (chatActivity.status === 'processing' || chatActivity.status === 'recording')
  );
  const hasThreadContent = Boolean(segments.length > 0 || chatActivity || audioName);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Claude-Style Borderless Full-Height Inference Stream */}
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Empty Welcome State */}
          {!hasThreadContent && (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center space-y-3.5 py-8">
              <div className="w-11 h-11 rounded-full bg-[#1db954] text-[#08100b] flex items-center justify-center font-bold text-lg shadow-[0_6px_22px_rgba(29,185,84,0.28)]">
                S
              </div>
              <h4 className="text-2xl font-semibold text-[#e4e7ec] font-display tracking-tight">
                {getTimeBasedGreeting()}{userName ? `, ${userName}` : ''}
              </h4>
              <p className="text-sm text-[#9ca3af] max-w-md mx-auto leading-relaxed">
                Drop an audio or video file or start your microphone below. Speaker-labeled transcript blocks will stream right here.
              </p>
            </div>
          )}

          {/* User Turn Prompt Bubble */}
          {hasThreadContent && (chatActivity || audioName) && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#1e2025] border border-[#2d3038] px-4 py-2.5 text-xs text-[#e4e7ec] flex items-center gap-2.5 shadow-sm">
                <div className="w-6 h-6 rounded-full bg-[#1db954]/15 text-[#3fb970] flex items-center justify-center shrink-0">
                  {chatActivity?.sourceType === 'record' ? (
                    <Mic className="w-3.5 h-3.5" />
                  ) : (
                    <FileAudio className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#e4e7ec] truncate">
                    {chatActivity?.sourceLabel || audioTitle || audioName}
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {chatActivity?.status === 'recording'
                      ? 'Live microphone capture'
                      : chatActivity?.status === 'processing'
                      ? 'Transcribing audio locally'
                      : audioName && audioTitle && audioName !== audioTitle
                      ? audioName
                      : 'Audio transcribed into speaker blocks'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assistant Inference Lead + Live Trace + Unchanged Subtitle Blocks */}
          {(segments.length > 0 || hasLiveTrace) && (
            <div className="space-y-4">
              {/* Claude Code Style Inference Turn Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#1db954] text-[#08100b] flex items-center justify-center font-bold text-xs shrink-0">
                    S
                  </div>
                  <span className="text-xs font-semibold text-[#e4e7ec]">Scriby</span>
                  <span className="text-[#4a4e57]">·</span>
                  <span className="text-xs text-[#9ca3af] font-mono">Moonshine Local STT</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#6f7682] shrink-0">
                  {isTranscribing
                    ? `Streaming · ${segments.length} ready`
                    : chatActivity?.status === 'recording'
                    ? `Recording · ${formatPlayerTime(chatActivity.recordingSeconds || 0)}`
                    : `${segments.length} ${segments.length === 1 ? 'block' : 'blocks'}`}
                </span>
              </div>

              {/* Claude Code Style Execution Trace Step Block (Only While Processing or Live Recording) */}
              {hasLiveTrace && chatActivity && (
                <div className="rounded-xl bg-[#16171b] border border-[#282b33] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {chatActivity.status === 'recording' ? (
                        <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-[#3fb970] animate-spin shrink-0" />
                      )}
                      <Terminal className="w-3.5 h-3.5 text-[#6f7682] shrink-0 hidden sm:block" />
                      <span className="font-mono text-[#e4e7ec] truncate">
                        {chatActivity.status === 'recording'
                          ? `Live Microphone (${formatPlayerTime(chatActivity.recordingSeconds || 0)})`
                          : chatActivity.loadingStep || 'Running Moonshine WASM inference...'}
                      </span>
                    </div>

                    {chatActivity.status === 'processing' && onCancelTranscription && (
                      <button
                        type="button"
                        onClick={onCancelTranscription}
                        className="px-2.5 py-1 bg-[#202227] hover:bg-[#2a2d34] text-[#d0d5dd] rounded-md border border-[#32363f] text-[11px] font-medium cursor-pointer shrink-0"
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
                          <span className="truncate max-w-[240px]">
                            Caching {chatActivity.downloadProgress.file}
                          </span>
                          <span>{Math.round(chatActivity.downloadProgress.fraction * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#24262c] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1db954] transition-all duration-150"
                            style={{
                              width: `${Math.round(chatActivity.downloadProgress.fraction * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                  {chatActivity.chunkProgress && chatActivity.chunkProgress.totalChunks > 1 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#9ca3af]">
                        <span>
                          Segment {chatActivity.chunkProgress.currentChunk} of{' '}
                          {chatActivity.chunkProgress.totalChunks}
                        </span>
                        <span>
                          {formatPlayerTime(chatActivity.chunkProgress.processedSeconds)} /{' '}
                          {formatPlayerTime(chatActivity.chunkProgress.totalSeconds)} ·{' '}
                          {Math.round(chatActivity.chunkProgress.fraction * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#24262c] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1db954] transition-all duration-150"
                          style={{
                            width: `${Math.max(
                              3,
                              Math.round(chatActivity.chunkProgress.fraction * 100)
                            )}%`,
                          }}
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
                    ((chatActivity.liveCommittedLines &&
                      chatActivity.liveCommittedLines.length > 0) ||
                      chatActivity.livePartialText) && (
                      <div className="p-2.5 rounded-lg bg-[#121316] border border-[#262930] space-y-1 max-h-32 overflow-y-auto text-xs">
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
              )}

              {/* Subtitle Blocks (Exact Unchanged Internal Card Design) */}
              {segments.length > 0 && (
                <div className="space-y-3.5">
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

                        {/* Unchanged Internal Block Design */}
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
                                title={
                                  isSpeaking
                                    ? 'Stop speaking'
                                    : 'Read text aloud (Text-to-Speech)'
                                }
                              >
                                <Volume2
                                  className={`w-3.5 h-3.5 ${
                                    isSpeaking ? 'text-[#3fb970]' : 'text-[#9ca3af]'
                                  }`}
                                />
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Docked Claude-Code-Style Bottom Composer */}
      {composerFooter && (
        <div className="shrink-0 px-4 sm:px-6 pb-4 pt-2 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent">
          {composerFooter}
        </div>
      )}
    </div>
  );
};
