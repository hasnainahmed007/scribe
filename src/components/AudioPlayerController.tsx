import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Repeat,
} from 'lucide-react';
import { formatPlayerTime } from '../utils/timeFormat';

interface AudioPlayerControllerProps {
  audioUrl: string;
  audioName: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isLooping: boolean;
  compact?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleLoop: () => void;
}

export const AudioPlayerController: React.FC<AudioPlayerControllerProps> = ({
  audioName,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  volume,
  isLooping,
  compact = false,
  onPlayPause,
  onSeek,
  onPlaybackRateChange,
  onVolumeChange,
  onToggleLoop,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Safe positive finite duration
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  const progressPercent =
    safeDuration > 0 ? Math.min(100, Math.max(0, (safeCurrentTime / safeDuration) * 100)) : 0;

  const calculateSeekTime = useCallback(
    (clientX: number): number => {
      if (!progressBarRef.current || safeDuration <= 0) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = clickX / rect.width;
      return percentage * safeDuration;
    },
    [safeDuration]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    setIsDragging(true);
    const newTime = calculateSeekTime(e.clientX);
    onSeek(newTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || safeDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = clickX / rect.width;
    setHoverPosition(clickX);
    setHoverTime(percentage * safeDuration);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && safeDuration > 0) {
        const newTime = calculateSeekTime(e.clientX);
        onSeek(newTime);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, safeDuration, calculateSeekTime, onSeek]);

  return (
    <div
      className={
        compact
          ? 'select-none space-y-3'
          : 'bg-[#181818] border border-[#282828] rounded-xl p-4 shadow-[0_6px_18px_rgba(0,0,0,0.4)] select-none'
      }
    >
      {/* Audio Track Header & Timecode Readout */}
      <div className="flex items-center justify-between gap-2 text-xs text-[#9ca3af]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isPlaying ? 'bg-[#1db954]' : 'bg-[#4d4d4d]'}`} />
          <span className="font-semibold text-[#e4e7ec] truncate font-display" title={audioName}>
            {audioName || 'Active Audio Recording'}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono tabular-nums text-xs shrink-0">
          <span className="text-[#3fb970] font-semibold">{formatPlayerTime(safeCurrentTime)}</span>
          <span className="text-[#4d4d4d]">/</span>
          <span className="text-[#9ca3af]">{formatPlayerTime(safeDuration)}</span>
        </div>
      </div>

      {/* Scrubber Timeline Bar */}
      <div
        ref={progressBarRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group relative h-2 bg-[#2c2f36] rounded-full cursor-pointer overflow-visible hover:h-2.5 transition-all ${
          compact ? 'my-2' : 'mb-4'
        }`}
        title="Click or drag to seek"
      >
        <div
          className="h-full bg-[#1db954] rounded-full relative transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-[#e4e7ec] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Hover Timecode Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-2.5 py-0.5 bg-[#24272c] text-[#e4e7ec] text-xs font-mono tabular-nums rounded-full border border-[#3a3e46] shadow-md pointer-events-none"
            style={{ left: `${hoverPosition}px` }}
          >
            {formatPlayerTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Control Actions Row */}
      <div className={compact ? 'space-y-2.5 text-xs' : 'flex items-center justify-between flex-wrap gap-4 text-xs'}>
        <div className="flex items-center justify-between gap-2">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, safeCurrentTime - 5))}
              className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] transition-colors cursor-pointer"
              title="Rewind 5 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onPlayPause}
              className="w-9 h-9 rounded-full bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer font-semibold"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSeek(Math.min(safeDuration, safeCurrentTime + 5))}
              className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] transition-colors cursor-pointer"
              title="Forward 5 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleLoop}
              className={`p-1.5 rounded-full transition-colors cursor-pointer relative ${
                isLooping ? 'text-[#3fb970]' : 'text-[#6f7682] hover:text-[#9ca3af]'
              }`}
              title={isLooping ? 'Looping enabled' : 'Loop disabled'}
            >
              <Repeat className="w-4 h-4" />
              {isLooping && (
                <span className="w-1 h-1 rounded-full bg-[#1db954] absolute bottom-0 left-1/2 -translate-x-1/2" />
              )}
            </button>
          </div>

          {compact && (
            <div className="flex items-center gap-1.5 text-[#9ca3af]">
              <button
                type="button"
                onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
                className="hover:text-[#e4e7ec] cursor-pointer p-1"
                title={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-[#e88791]" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-[#34373f] rounded-full appearance-none cursor-pointer accent-[#1db954]"
                title="Volume Control"
              />
            </div>
          )}
        </div>

        {/* Playback Speed Segmented Buttons */}
        <div
          className={`flex items-center gap-1 bg-[#121212] p-1 rounded-full border border-[#282828] ${
            compact ? 'justify-between' : ''
          }`}
        >
          <span className="text-[11px] text-[#6f7682] font-medium px-2">Speed:</span>
          <div className="flex items-center gap-0.5">
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onPlaybackRateChange(rate)}
                className={`px-2 py-0.5 text-[11px] font-mono rounded-full transition-colors cursor-pointer ${
                  playbackRate === rate
                    ? 'bg-[#262930] text-[#3fb970] font-semibold'
                    : 'text-[#9ca3af] hover:text-[#e4e7ec]'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume Slider (non-compact row placement) */}
        {!compact && (
          <div className="flex items-center gap-2 text-[#9ca3af]">
            <button
              type="button"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
              className="hover:text-[#e4e7ec] cursor-pointer p-1"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX className="w-4 h-4 text-[#e88791]" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-1 bg-[#34373f] rounded-full appearance-none cursor-pointer accent-[#1db954]"
              title="Volume Control"
            />
          </div>
        )}
      </div>
    </div>
  );
};
