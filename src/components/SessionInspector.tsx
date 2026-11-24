import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Replace,
  Plus,
  Combine,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Volume2,
  FileText,
  PanelRightClose,
} from 'lucide-react';
import { AudioSource, TranscriptSegment } from '../types';
import { AudioPlayerController } from './AudioPlayerController';
import { formatPlayerTime } from '../utils/timeFormat';
import { Tooltip } from './ui/Tooltip';

interface SessionInspectorProps {
  audioSource: AudioSource | null;
  segments: TranscriptSegment[];
  summary: string;
  isTranscribing: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isLooping: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleLoop: () => void;
  onAddSegment: () => void;
  onMergeAllSegments?: () => void;
  onUndoMergeAll?: () => void;
  canUndoMergeAll?: boolean;
  onSearchReplace: (searchTerm: string, replaceTerm: string) => number;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionInspector: React.FC<SessionInspectorProps> = ({
  audioSource,
  segments,
  summary,
  isTranscribing,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  volume,
  isLooping,
  onPlayPause,
  onSeek,
  onPlaybackRateChange,
  onVolumeChange,
  onToggleLoop,
  onAddSegment,
  onMergeAllSegments,
  onUndoMergeAll,
  canUndoMergeAll = false,
  onSearchReplace,
  isOpen,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [replaceCount, setReplaceCount] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showMergeAllConfirm, setShowMergeAllConfirm] = useState(false);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!canUndoMergeAll) {
      setShowUndoBanner(false);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    }
  }, [canUndoMergeAll]);

  const handleExecuteReplace = () => {
    if (!searchTerm.trim()) return;
    const count = onSearchReplace(searchTerm, replaceTerm);
    setReplaceCount(count);
    setTimeout(() => setReplaceCount(null), 3000);
  };

  const handleExecuteMergeAll = () => {
    onMergeAllSegments?.();
    setShowMergeAllConfirm(false);
    setShowUndoBanner(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setShowUndoBanner(false);
    }, 5000);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setShowUndoBanner(false);
    onUndoMergeAll?.();
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

  const hasContent = Boolean(
    audioSource || segments.length > 0 || (summary && !isTranscribing)
  );
  if (!hasContent) return null;

  const inspectorInner = (
    <div className="flex flex-col h-full w-[348px] max-w-full bg-[#131315] border-l border-[#24262c]">
      {/* Inspector Header */}
      <div className="px-4 py-3 border-b border-[#24262c] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#e4e7ec]">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#3fb970]" />
          <span>Session Inspector</span>
        </div>
        <Tooltip content="Collapse sidebar" side="left">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#1a1c22] hover:bg-[#242832] border border-[#2a2e39] text-[#9ca3af] hover:text-[#4cc37c] flex items-center justify-center transition-all cursor-pointer"
            aria-label="Collapse session inspector"
          >
            <PanelRightClose className="w-3.5 h-3.5 hidden xl:block" />
            <X className="w-3.5 h-3.5 xl:hidden" />
          </button>
        </Tooltip>
      </div>

      {/* Scrollable Inspector Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#22252b]">
        {/* Section 1: Audio Player & Timeline */}
        {audioSource && (
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
              <Volume2 className="w-3.5 h-3.5 text-[#3fb970]" />
              <span>Audio Playback</span>
            </div>
            <AudioPlayerController
              compact
              audioUrl={audioSource.url}
              audioName={audioSource.name}
              currentTime={currentTime}
              duration={
                Number.isFinite(duration) && duration > 0
                  ? duration
                  : audioSource.duration || 0
              }
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              volume={volume}
              isLooping={isLooping}
              onPlayPause={onPlayPause}
              onSeek={onSeek}
              onPlaybackRateChange={onPlaybackRateChange}
              onVolumeChange={onVolumeChange}
              onToggleLoop={onToggleLoop}
            />
          </div>
        )}

        {/* Section 2: Audio Synopsis (Only when transcription is ready) */}
        {summary && !isTranscribing && segments.length > 0 && (
          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => setShowSummary((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] hover:text-[#e4e7ec] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#3fb970]" />
                <span>Audio Synopsis</span>
              </span>
              {showSummary ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#6f7682]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#6f7682]" />
              )}
            </button>
            {showSummary && (
              <p className="text-xs text-[#c2c8d1] leading-relaxed">{summary}</p>
            )}
          </div>
        )}

        {/* Section 3: Transcript Stats, Quick Actions & Find/Replace */}
        {segments.length > 0 && (
          <div className="p-4 space-y-3.5">
            <button
              type="button"
              onClick={() => setShowTools((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] hover:text-[#e4e7ec] cursor-pointer"
            >
              <span>Transcript Tools</span>
              {showTools ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#6f7682]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#6f7682]" />
              )}
            </button>

            {showTools && (
              <div className="space-y-3.5">
                {/* 2x2 Tabular Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-[#181a1f] border border-[#24272f]">
                    <div className="text-[11px] text-[#9ca3af]">Segments</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#3fb970]">
                      {segments.length}
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#181a1f] border border-[#24272f]">
                    <div className="text-[11px] text-[#9ca3af]">Speakers</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#e4e7ec]">
                      {Math.max(1, uniqueSpeakers.length)}
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#181a1f] border border-[#24272f]">
                    <div className="text-[11px] text-[#9ca3af]">Words</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#e4e7ec]">
                      {totalWords}
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#181a1f] border border-[#24272f]">
                    <div className="text-[11px] text-[#9ca3af]">Pacing</div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#e4e7ec]">
                      {estimatedWpm} <span className="text-[11px] font-sans text-[#6f7682]">wpm</span>
                    </div>
                  </div>
                </div>

                {/* Quick Block Operations */}
                <div className="flex items-center gap-2">
                  <Tooltip
                    content={
                      segments.length > 1
                        ? `Merge all ${segments.length} segments into 1 block`
                        : 'Requires at least 2 segments to merge'
                    }
                    side="top"
                    className="flex-1 flex"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (segments.length > 1) setShowMergeAllConfirm(true);
                      }}
                      disabled={segments.length <= 1}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1a1c21] hover:bg-[#23262d] disabled:opacity-40 disabled:cursor-not-allowed text-[#d0d5dd] rounded-lg text-xs font-medium border border-[#2b2e37] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Combine className="w-3.5 h-3.5 text-[#34a866]" />
                      <span>Merge All</span>
                    </button>
                  </Tooltip>

                  <button
                    type="button"
                    onClick={onAddSegment}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1a1c21] hover:bg-[#23262d] text-[#d0d5dd] rounded-lg text-xs font-medium border border-[#2b2e37] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#34a866]" />
                    <span>Add Block</span>
                  </button>
                </div>

                {/* Inline Merge All Confirmation */}
                {showMergeAllConfirm && (
                  <div className="p-3 rounded-lg bg-[#181a1f] border border-[#32363f] space-y-2 text-xs">
                    <div className="font-semibold text-[#e4e7ec]">
                      Merge all {segments.length} blocks?
                    </div>
                    <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                      Combines blocks from{' '}
                      <span className="font-mono text-[#d0d5dd]">
                        {formatPlayerTime(segments[0]?.start ?? 0)}
                      </span>{' '}
                      to{' '}
                      <span className="font-mono text-[#d0d5dd]">
                        {formatPlayerTime(segments[segments.length - 1]?.end ?? 0)}
                      </span>
                      .
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowMergeAllConfirm(false)}
                        className="px-2.5 py-1 text-[#9ca3af] hover:text-[#e4e7ec] rounded hover:bg-[#282828] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteMergeAll}
                        className="px-3 py-1 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold rounded cursor-pointer"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                {/* Undo Merge Banner */}
                {showUndoBanner && canUndoMergeAll && onUndoMergeAll && !showMergeAllConfirm && (
                  <div className="p-2.5 rounded-lg bg-[#16201a] border border-[#1db954]/30 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#d0d5dd] flex items-center gap-1.5 truncate">
                      <Check className="w-3.5 h-3.5 text-[#3fb970] shrink-0" />
                      <span className="truncate">Merged into 1 block</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold rounded cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  </div>
                )}

                {/* Search & Replace */}
                <div className="space-y-2 pt-1 border-t border-[#22252b]">
                  <div className="text-[11px] font-medium text-[#9ca3af]">Find &amp; Replace</div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6f7682] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Find spoken words..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#1a1c20] border border-[#2b2e37] rounded-lg text-xs text-[#d0d5dd] placeholder-[#6f7682] focus:outline-none focus:border-[#1db954]/55 transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <Replace className="w-3.5 h-3.5 text-[#6f7682] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Replace with..."
                      value={replaceTerm}
                      onChange={(e) => setReplaceTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#1a1c20] border border-[#2b2e37] rounded-lg text-xs text-[#d0d5dd] placeholder-[#6f7682] focus:outline-none focus:border-[#1db954]/55 transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleExecuteReplace}
                      disabled={!searchTerm.trim()}
                      className="px-3.5 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] disabled:opacity-40 text-[#08100b] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Replace All
                    </button>
                    {replaceCount !== null && (
                      <span className="text-xs font-mono text-[#3fb970]">
                        {replaceCount} replaced
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Right Inspector Rail */}
      <aside
        aria-hidden={!isOpen}
        className={`hidden xl:block shrink-0 h-full overflow-hidden transition-[width,opacity] duration-200 ease-out ${
          isOpen ? 'w-[348px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        {inspectorInner}
      </aside>

      {/* Tablet / Mobile Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex justify-end">
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs" onClick={onClose} />
          <aside className="relative w-80 max-w-[90vw] h-full z-10 shadow-2xl">
            {inspectorInner}
          </aside>
        </div>
      )}
    </>
  );
};
