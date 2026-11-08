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
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { formatPlayerTime } from '../utils/timeFormat';

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  summary: string;
  currentTime: number;
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
  currentTime,
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
    const isBengali = /[\u0980-\u09FF]/.test(text);

    if (isBengali) {
      utterance.lang = 'bn-BD';
      const bnVoice = voices.find((v) => v.lang.startsWith('bn') || v.name.toLowerCase().includes('bengali'));
      if (bnVoice) utterance.voice = bnVoice;
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

  return (
    <div className="space-y-4">
      {/* Editor Statistics & Global Search Toolbar */}
      <div className="bg-[#181818] border border-[#282828] rounded-xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.5)] space-y-3.5">
        {/* Metadata Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#282828] text-xs text-[#b3b3b3]">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold">
              Segments: <span className="font-mono text-[#1ed760] font-bold tabular-nums">{segments.length}</span>
            </span>
            <span className="text-[#4d4d4d]">·</span>
            <span>
              Words: <span className="font-mono text-white tabular-nums">{totalWords}</span>
            </span>
            <span className="text-[#4d4d4d]">·</span>
            <span>
              Pacing: <span className="font-mono text-white tabular-nums">{estimatedWpm}</span> wpm
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold border border-[#3e3e3e] transition-all cursor-pointer hover:scale-104 shadow-sm"
                title={
                  segments.length > 1
                    ? `Merge all ${segments.length} subtitle segments into 1 continuous block`
                    : 'Requires at least 2 subtitle segments to merge'
                }
                aria-label="Merge all subtitle segments"
              >
                <Combine className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Merge All</span>
                {segments.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#2a2a2a] text-[10px] text-[#b3b3b3] font-mono tabular-nums leading-none">
                    {segments.length}
                  </span>
                )}
              </button>

              {/* Styled Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 transition-all opacity-0 group-hover:opacity-100 duration-200">
                <div className="bg-[#121212] text-white text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#383838] shadow-[0_8px_24px_rgba(0,0,0,0.85)] whitespace-nowrap flex items-center gap-1.5">
                  <Combine className="w-3 h-3 text-[#1ed760] shrink-0" />
                  <span>
                    {segments.length > 1
                      ? `Merge all ${segments.length} segments into 1 continuous subtitle block`
                      : 'Requires at least 2 segments to merge'}
                  </span>
                </div>
                <div className="w-2 h-2 bg-[#121212] border-r border-b border-[#383838] rotate-45 -mt-1" />
              </div>
            </div>

            {/* Add Subtitle Block Button */}
            <button
              onClick={() => onAddSegment()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] text-white rounded-full text-xs font-bold border border-[#3e3e3e] transition-all cursor-pointer hover:scale-104"
            >
              <Plus className="w-3.5 h-3.5 text-[#1ed760]" />
              <span>Add Subtitle Block</span>
            </button>
          </div>
        </div>

        {/* Global Search and Replace (Spotify Pill Inputs) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#7c7c7c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find spoken words or phrases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#1f1f1f] border border-[#2e2e2e] rounded-full text-xs text-white placeholder-[#7c7c7c] focus:outline-none focus:border-white transition-colors font-sans"
            />
          </div>

          <div className="relative flex-1">
            <Replace className="w-3.5 h-3.5 text-[#7c7c7c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#1f1f1f] border border-[#2e2e2e] rounded-full text-xs text-white placeholder-[#7c7c7c] focus:outline-none focus:border-white transition-colors font-sans"
            />
          </div>

          <button
            onClick={handleExecuteReplace}
            disabled={!searchTerm.trim()}
            className="px-5 py-1.5 bg-[#1ed760] hover:bg-[#1fdf64] disabled:opacity-40 text-black text-xs font-bold rounded-full transition-all whitespace-nowrap cursor-pointer shrink-0 hover:scale-104"
          >
            Replace All
          </button>

          {replaceCount !== null && (
            <span className="text-xs font-mono text-[#1ed760] self-center">
              {replaceCount} replaced
            </span>
          )}
        </div>
      </div>

      {/* Merge All Confirmation Prompt */}
      {showMergeAllConfirm && (
        <div className="p-3.5 bg-[#181818] border border-[#3e3e3e] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-white shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#1ed760]/20 flex items-center justify-center text-[#1ed760] shrink-0">
              <Combine className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white">Merge all {segments.length} subtitle segments?</div>
              <div className="text-[11px] text-[#b3b3b3]">
                This combines all {segments.length} blocks into 1 continuous segment from{' '}
                <span className="font-mono text-white">{formatPlayerTime(segments[0]?.start ?? 0)}</span> to{' '}
                <span className="font-mono text-white">{formatPlayerTime(segments[segments.length - 1]?.end ?? 0)}</span>. You can undo this action anytime.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMergeAllConfirm(false)}
              className="px-3 py-1.5 text-xs text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteMergeAll}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs rounded-full cursor-pointer transition-transform hover:scale-104 shadow-md"
            >
              <Combine className="w-3.5 h-3.5" />
              <span>Yes, Merge All</span>
            </button>
          </div>
        </div>
      )}

      {/* Undo Merge Notification Banner (Auto-dismisses after 5 seconds or manually closeable) */}
      {showUndoBanner && canUndoMergeAll && onUndoMergeAll && !showMergeAllConfirm && (
        <div className="p-3 bg-[#132517] border border-[#1ed760]/40 rounded-xl flex items-center justify-between gap-3 text-xs text-white shadow-lg animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#1ed760]/20 flex items-center justify-center text-[#1ed760] shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[#e2e8f0] font-medium">
                All subtitle segments have been merged into 1 continuous block.
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#7c7c7c] ml-2 font-mono">
                (auto-closes in 5s)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1ed760] hover:bg-[#1fdf64] text-black text-xs font-bold rounded-full cursor-pointer transition-transform hover:scale-104 shrink-0 shadow-sm"
              title="Restore original separated subtitle segments"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Merge</span>
            </button>
            <button
              type="button"
              onClick={handleDismissUndoAlert}
              className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Close notification"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Summary Accordion Strip */}
      {summary && (
        <div className="p-4 rounded-xl bg-[#0f1726] border border-slate-800 text-xs text-slate-300">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Audio Synopsis
            </span>
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
            >
              {showSummary ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {showSummary && <p className="text-slate-300 leading-relaxed text-sm">{summary}</p>}
        </div>
      )}

      {/* Segment Cards List */}
      <div className="space-y-3">
        {segments.length === 0 ? (
          <div className="p-10 text-center bg-[#181818] border border-dashed border-[#282828] rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#242424] text-[#1ed760] flex items-center justify-center mx-auto">
              <FileAudio className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-display">Studio Workspace is Clean</h4>
              <p className="text-xs text-[#878787] mt-1 max-w-md mx-auto">
                No active transcript loaded. Upload or record audio with the Transcribe button, open a session from History, or send audio from Voiceover Studio.
              </p>
            </div>
          </div>
        ) : (
          segments.map((seg, index) => {
          const isActive = currentTime >= seg.start && currentTime <= seg.end;
          const isSpeaking = speakingSegmentId === seg.id;

          return (
            <div
              key={seg.id}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'bg-[#1f1f1f] border-[#1ed760] shadow-[0_8px_20px_rgba(30,215,96,0.15)] ring-1 ring-[#1ed760]/30'
                  : 'bg-[#181818] border-[#282828] hover:border-[#383838]'
              }`}
            >
              {/* Segment Metadata & Actions Header */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-mono tabular-nums text-[#7c7c7c]">
                    #{index + 1}
                  </span>

                  {/* Play Audio Block Timestamp Button */}
                  <button
                    onClick={() => handlePlayBlockAudio(seg)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#121212] hover:bg-[#282828] rounded-full text-xs font-mono tabular-nums text-white border border-[#2e2e2e] transition-all cursor-pointer hover:scale-104"
                    title="Play audio from this timestamp"
                  >
                    <Play className="w-3 h-3 fill-current text-[#1ed760]" />
                    <span>
                      {formatPlayerTime(seg.start)} – {formatPlayerTime(seg.end)}
                    </span>
                  </button>

                  {/* Dedicated Text-To-Speech (TTS) Voice Button */}
                  <button
                    onClick={() => handleSpeakText(seg.id, seg.text)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      isSpeaking
                        ? 'bg-[#282828] text-[#1ed760] border-[#1ed760]'
                        : 'bg-[#121212] hover:bg-[#282828] text-[#b3b3b3] hover:text-white border-[#2e2e2e]'
                    }`}
                    title={isSpeaking ? 'Stop speaking' : 'Read text aloud (Text-to-Speech)'}
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}`} />
                    <span className="text-[11px] font-mono">
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
                        className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-white w-28 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveSpeaker(seg.id);
                        }}
                      />
                      <button
                        onClick={() => handleSaveSpeaker(seg.id)}
                        className="p-1 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingSpeakerId(seg.id);
                        setSpeakerInputValue(seg.speaker);
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-[11px] font-medium border border-slate-800 transition-colors cursor-pointer"
                      title="Click to rename speaker"
                    >
                      <User className="w-3 h-3 text-slate-500" />
                      <span>{seg.speaker || 'Speaker'}</span>
                    </button>
                  )}
                </div>

                {/* Subtitle Action Tools */}
                <div className="flex items-center gap-1 text-slate-400">
                  {index < segments.length - 1 && (
                    <button
                      onClick={() => onMergeSegments(seg.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      title="Merge with next block"
                    >
                      <Merge className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onAddSegment(seg.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                    title="Insert block below"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteSegment(seg.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
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
                className="w-full bg-transparent border-0 text-sm text-slate-100 leading-relaxed focus:outline-none focus:bg-slate-900/60 p-2 rounded-lg resize-y transition-colors"
                placeholder="Type subtitle segment text..."
              />
            </div>
          );
        })
      )}
      </div>
    </div>
  );
};
