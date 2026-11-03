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
    <div className="bg-[#181818] border border-[#282828] rounded-xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.5)] select-none">
      {/* Audio Track Header & Timecode Readout */}
      <div className="flex items-center justify-between text-xs mb-3 text-[#b3b3b3]">
        <div className="flex items-center gap-2 truncate max-w-[60%]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isPlaying ? 'bg-[#1ed760] animate-pulse' : 'bg-[#4d4d4d]'}`} />
          <span className="font-bold text-white truncate font-display">
            {audioName || 'Active Audio Recording'}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono tabular-nums text-xs">
          <span className="text-[#1ed760] font-semibold">{formatPlayerTime(safeCurrentTime)}</span>
          <span className="text-[#4d4d4d]">/</span>
          <span className="text-[#b3b3b3]">{formatPlayerTime(safeDuration)}</span>
        </div>
      </div>

      {/* Scrubber Timeline Bar (Spotify Style) */}
      <div
        ref={progressBarRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative h-2 bg-[#4d4d4d] rounded-full cursor-pointer overflow-visible mb-4 hover:h-2.5 transition-all"
        title="Click or drag to seek"
      >
        <div
          className="h-full bg-[#1ed760] rounded-full relative transition-all duration-75 group-hover:bg-[#1ed760]"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Hover Timecode Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-[#282828] text-white text-[10px] font-mono rounded-full border border-[#3e3e3e] shadow-md pointer-events-none"
            style={{ left: `${hoverPosition}px` }}
          >
            {formatPlayerTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Control Actions Row */}
      <div className="flex items-center justify-between flex-wrap gap-4 text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSeek(Math.max(0, safeCurrentTime - 5))}
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
            title="Rewind 5 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Spotify Circular Play Button */}
          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 text-black flex items-center justify-center transition-all shadow-[0_4px_12px_rgba(30,215,96,0.3)] active:scale-95 cursor-pointer font-bold"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => onSeek(Math.min(safeDuration, safeCurrentTime + 5))}
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
            title="Forward 5 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleLoop}
            className={`p-1.5 rounded-full transition-colors cursor-pointer relative ${
              isLooping ? 'text-[#1ed760]' : 'text-[#7c7c7c] hover:text-[#b3b3b3]'
            }`}
            title={isLooping ? 'Looping enabled' : 'Loop disabled'}
          >
            <Repeat className="w-4 h-4" />
            {isLooping && (
              <span className="w-1 h-1 rounded-full bg-[#1ed760] absolute bottom-0 left-1/2 -translate-x-1/2" />
            )}
          </button>
        </div>

        {/* Playback Speed Segmented Buttons */}
        <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-full border border-[#282828]">
          <span className="text-[11px] text-[#7c7c7c] font-medium px-2">Speed:</span>
          {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
            <button
              key={rate}
              onClick={() => onPlaybackRateChange(rate)}
              className={`px-2.5 py-0.5 text-xs font-mono rounded-full transition-colors cursor-pointer ${
                playbackRate === rate
                  ? 'bg-[#282828] text-[#1ed760] font-bold'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-2 text-[#b3b3b3]">
          <button
            onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
            className="hover:text-white cursor-pointer p-1"
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4 text-[#f3727f]" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer accent-[#1ed760]"
            title="Volume Control"
          />
        </div>
      </div>
    </div>
  );
};
