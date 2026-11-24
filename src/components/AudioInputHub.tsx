import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Mic,
  Square,
  RotateCcw,
  Sparkles,
  FileAudio,
  AlertCircle,
  Loader2,
  ExternalLink,
  Cpu,
  Globe,
  X,
} from 'lucide-react';
import { TranscriptSegment, AudioSource } from '../types';
import { formatPlayerTime } from '../utils/timeFormat';
import { preparePlayableAudio } from '../utils/audioProcessing';
import { cacheTranscriptAudio } from '../utils/audioStorage';
import { useAuth } from '../context/AuthContext';
import { safeFetchJson, sanitizeErrorMessage } from '../utils/apiClient';
import { getSttLanguages, getLanguageOption, MoonshineArchKey } from '../utils/voiceLanguages';
import { generateKeyPointTitle } from '../utils/subtitleUtils';
import {
  transcribeAudioFileWithMoonshine,
  startMoonshineLiveMicSession,
  abortActiveSttSession,
  isCrossOriginIsolatedReady,
  blobToBase64,
  MoonshineIsolationError,
  MoonshineSttCancelledError,
  MoonshineDownloadProgress,
  MoonshineTranscriptionProgress,
  LiveMicCaptureSession,
} from '../utils/moonshineEngine';

export interface ChatSttActivity {
  sourceLabel: string;
  sourceType: 'upload' | 'record';
  status: 'processing' | 'recording' | 'ready';
  loadingStep: string;
  downloadProgress: MoonshineDownloadProgress | null;
  chunkProgress: MoonshineTranscriptionProgress | null;
  recordingSeconds?: number;
  livePartialText?: string;
  liveCommittedLines?: Array<{ id: string; text: string; startTime: number }>;
}

interface AudioInputHubProps {
  onTranscriptionStart?: (sourceLabel: string, sourceType: 'upload' | 'record') => void;
  onPartialSegments?: (segments: TranscriptSegment[]) => void;
  onTranscriptionComplete: (
    audioSource: AudioSource,
    segments: TranscriptSegment[],
    fullTranscript: string,
    summary: string
  ) => void;
  onTranscriptionAbort?: () => void;
  onActivityChange?: (activity: ChatSttActivity | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  onOpenPricing?: () => void;
  onQuotaExceeded?: (message: string) => void;
}

const ENGLISH_ARCH_OPTIONS: Array<{ value: MoonshineArchKey; label: string }> = [
  { value: 'medium_streaming', label: 'Medium Streaming (~304 MB)' },
  { value: 'small_streaming', label: 'Small Streaming (Balanced)' },
  { value: 'tiny_streaming', label: 'Tiny Streaming (Fastest)' },
  { value: 'base', label: 'Base (Non-streaming)' },
  { value: 'tiny', label: 'Tiny (Ultra-Light)' },
];

function formatBytesMb(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0.0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AudioInputHub: React.FC<AudioInputHubProps> = ({
  onTranscriptionStart,
  onPartialSegments,
  onTranscriptionComplete,
  onTranscriptionAbort,
  onActivityChange,
  isLoading,
  setIsLoading,
  onOpenPricing,
}) => {
  const { token, user, refreshProfile } = useAuth();
  const [activeMode, setActiveMode] = useState<'upload' | 'record'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsStandaloneTab, setNeedsStandaloneTab] = useState<boolean>(false);
  const [isCreditExceeded, setIsCreditExceeded] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>('');
  const [activeSourceType, setActiveSourceType] = useState<'upload' | 'record'>('upload');
  const [downloadProgress, setDownloadProgress] = useState<MoonshineDownloadProgress | null>(null);
  const [chunkProgress, setChunkProgress] = useState<MoonshineTranscriptionProgress | null>(null);

  // Moonshine Language & Model Arch Selection
  const sttLanguages = getSttLanguages();
  const [selectedSttLanguage, setSelectedSttLanguage] = useState<string>('en');
  const [selectedSttArch, setSelectedSttArch] = useState<MoonshineArchKey>('medium_streaming');

  // Live Mic Streaming State
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingMic, setIsStartingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [livePartialText, setLivePartialText] = useState<string>('');
  const [liveCommittedLines, setLiveCommittedLines] = useState<
    Array<{ id: string; text: string; startTime: number }>
  >([]);
  const [liveCapturedResult, setLiveCapturedResult] = useState<{
    durationSeconds: number;
    segments: TranscriptSegment[];
    fullTranscript: string;
    summary: string;
    language: string;
    modelArch: MoonshineArchKey;
  } | null>(null);

  const micSessionRef = useRef<LiveMicCaptureSession | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNeedsStandaloneTab(!isCrossOriginIsolatedReady());
    return () => {
      abortActiveSttSession();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (micSessionRef.current) {
        micSessionRef.current.abort();
        micSessionRef.current = null;
      }
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  // Sync live status up to chat thread stream
  useEffect(() => {
    if (!onActivityChange) return;
    if (isLoading) {
      onActivityChange({
        sourceLabel: activeSourceLabel || (activeSourceType === 'record' ? 'Live Microphone Audio' : 'Uploaded Audio'),
        sourceType: activeSourceType,
        status: 'processing',
        loadingStep,
        downloadProgress,
        chunkProgress,
      });
    } else if (isRecording || isStartingMic) {
      onActivityChange({
        sourceLabel: 'Live Microphone Recording',
        sourceType: 'record',
        status: 'recording',
        loadingStep: isStartingMic ? loadingStep : 'Listening and transcribing live...',
        downloadProgress,
        chunkProgress: null,
        recordingSeconds,
        livePartialText,
        liveCommittedLines,
      });
    } else {
      onActivityChange(null);
    }
  }, [
    isLoading,
    isRecording,
    isStartingMic,
    activeSourceLabel,
    activeSourceType,
    loadingStep,
    downloadProgress,
    chunkProgress,
    recordingSeconds,
    livePartialText,
    liveCommittedLines,
    onActivityChange,
  ]);

  const handleLanguageChange = (nextLang: string) => {
    setSelectedSttLanguage(nextLang);
    const opt = getLanguageOption(nextLang);
    if (opt?.defaultSttArch) {
      setSelectedSttArch(opt.defaultSttArch);
    }
  };

  const persistTranscriptAndOpen = async (params: {
    blob: Blob;
    audioName: string;
    size?: number;
    durationSeconds: number;
    mimeType: string;
    playableUrl: string;
    segments: TranscriptSegment[];
    fullTranscript: string;
    summary: string;
    language: string;
    modelArch: MoonshineArchKey;
  }) => {
    setLoadingStep('Generating key-point title & saving transcript...');

    let savedTranscriptId: number | undefined;
    const localKeyTitle = generateKeyPointTitle(
      params.fullTranscript,
      params.segments,
      params.audioName
    );
    let resolvedTitle = localKeyTitle;

    if (token) {
      const maxServerAudioBytes = 38 * 1024 * 1024;
      const audioBase64 =
        params.blob.size <= maxServerAudioBytes ? await blobToBase64(params.blob) : undefined;
      const res = await safeFetchJson<{
        success: boolean;
        data?: { savedTranscriptId?: number; title?: string };
        error?: string;
      }>('/api/transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: localKeyTitle,
          audioName: params.audioName,
          autoGenerateTitle: true,
          durationSeconds: params.durationSeconds,
          language: params.language,
          modelArch: params.modelArch,
          segments: params.segments,
          fullTranscript: params.fullTranscript,
          summary: params.summary,
          ...(audioBase64
            ? { audioBase64, mimeType: params.mimeType || 'audio/wav' }
            : {}),
        }),
      });

      if (res.status === 403) {
        setIsCreditExceeded(true);
        throw new Error(
          res.error || res.data?.error || 'Credit limit reached. Please upgrade your subscription plan.'
        );
      }

      if (!res.ok || !res.data?.success) {
        throw new Error(res.error || res.data?.error || 'Failed to save transcript to workspace.');
      }

      savedTranscriptId = res.data?.data?.savedTranscriptId;
      if (res.data?.data?.title && res.data.data.title.trim()) {
        resolvedTitle = res.data.data.title.trim();
      }
    }

    try {
      await cacheTranscriptAudio(savedTranscriptId, params.audioName, params.blob);
    } catch (storageErr) {
      console.warn('[AudioVault] Could not cache audio locally:', storageErr);
    }

    onTranscriptionComplete(
      {
        url: params.playableUrl,
        name: params.audioName,
        title: resolvedTitle,
        size: params.size,
        duration: params.durationSeconds,
        blob: params.blob,
        mimeType: params.mimeType,
      },
      params.segments,
      params.fullTranscript,
      params.summary
    );

    if (token) refreshProfile();
  };

  // Handle File Upload via local Moonshine WASM
  const processAudioFile = async (file: File) => {
    setErrorMessage(null);
    setIsCreditExceeded(false);
    setDownloadProgress(null);
    setChunkProgress(null);

    if (!isCrossOriginIsolatedReady()) {
      setNeedsStandaloneTab(true);
      setErrorMessage(
        'Local Moonshine WebAssembly requires SharedArrayBuffer isolation. Open Scriby in a standalone browser tab to run speech recognition.'
      );
      return;
    }

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage(
        'Audio credit limit reached (0 minutes left). Please upgrade your subscription plan to transcribe audio.'
      );
      return;
    }

    setActiveSourceLabel(file.name);
    setActiveSourceType('upload');
    setIsLoading(true);
    setLoadingStep('Initializing Moonshine WebAssembly engine...');
    onTranscriptionStart?.(file.name, 'upload');

    try {
      const result = await transcribeAudioFileWithMoonshine({
        fileOrBlob: file,
        language: selectedSttLanguage,
        arch: selectedSttArch,
        onProgress: (prog) => setDownloadProgress(prog),
        onStage: (stage) => setLoadingStep(stage),
        onChunkProgress: (prog) => setChunkProgress(prog),
        onPartialSegments: (segs) => onPartialSegments?.(segs),
      });

      setLoadingStep('Preparing audio waveform & timeline playback...');
      const processed = await preparePlayableAudio(file, file.name, result.durationSeconds);

      await persistTranscriptAndOpen({
        blob: processed.blob,
        audioName: file.name,
        size: file.size,
        durationSeconds: processed.duration || result.durationSeconds,
        mimeType: processed.mimeType || 'audio/wav',
        playableUrl: processed.url,
        segments: result.segments,
        fullTranscript: result.fullTranscript,
        summary: result.summary,
        language: result.language,
        modelArch: result.modelArch,
      });

      setIsLoading(false);
      setDownloadProgress(null);
      setChunkProgress(null);
    } catch (err: unknown) {
      if (err instanceof MoonshineSttCancelledError) {
        setIsLoading(false);
        setDownloadProgress(null);
        setChunkProgress(null);
        onTranscriptionAbort?.();
        return;
      }
      if (err instanceof MoonshineIsolationError) {
        setNeedsStandaloneTab(true);
      }
      const rawMsg = err instanceof Error ? err.message : 'Moonshine transcription failed.';
      const { message } = sanitizeErrorMessage(rawMsg);
      setErrorMessage(message);
      setIsLoading(false);
      setDownloadProgress(null);
      setChunkProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isLoading) return;
    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage(
        'Audio credit limit reached (0 minutes left). Please upgrade your subscription plan to continue.'
      );
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAudioFile(e.dataTransfer.files[0]);
    }
  };

  // Start Live Mic Streaming with Moonshine WASM
  const startRecording = async () => {
    setErrorMessage(null);
    setIsCreditExceeded(false);
    setDownloadProgress(null);

    if (!isCrossOriginIsolatedReady()) {
      setNeedsStandaloneTab(true);
      setErrorMessage(
        'Local Moonshine WebAssembly requires SharedArrayBuffer isolation. Open Scriby in a standalone browser tab to stream microphone transcription.'
      );
      return;
    }

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage(
        'Audio credit limit reached (0 minutes left). Please upgrade your subscription plan to record and transcribe audio.'
      );
      return;
    }

    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    setLiveCapturedResult(null);
    setLivePartialText('');
    setLiveCommittedLines([]);
    setIsStartingMic(true);
    setActiveSourceLabel('Live Microphone Audio');
    setActiveSourceType('record');
    setLoadingStep('Loading Moonshine WebAssembly model for live mic...');

    try {
      const session = await startMoonshineLiveMicSession({
        language: selectedSttLanguage,
        arch: selectedSttArch,
        onProgress: (prog) => setDownloadProgress(prog),
        onStage: (stage) => setLoadingStep(stage),
        onPartialText: (txt) => setLivePartialText(txt),
        onLineCommitted: (line) => {
          if (!line.text.trim()) return;
          setLiveCommittedLines((prev) => {
            const idx = prev.findIndex((item) => item.id === line.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { id: line.id, text: line.text, startTime: line.startTime };
              return copy;
            }
            return [...prev, { id: line.id, text: line.text, startTime: line.startTime }];
          });
        },
        onError: (err) => {
          console.warn('[Moonshine Live Mic]', err.message);
        },
      });

      micSessionRef.current = session;
      setIsStartingMic(false);
      setDownloadProgress(null);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      setIsStartingMic(false);
      setDownloadProgress(null);
      if (err instanceof MoonshineIsolationError) {
        setNeedsStandaloneTab(true);
      }
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Microphone access denied. Please grant microphone permissions in browser.';
      setErrorMessage(msg);
    }
  };

  // Stop Live Mic Streaming & Finalize WAV + Live Transcript
  const stopRecording = async () => {
    if (!micSessionRef.current || !isRecording) return;
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      const captured = await micSessionRef.current.stop();
      micSessionRef.current = null;
      const url = URL.createObjectURL(captured.audioBlob);
      setRecordedBlob(captured.audioBlob);
      setRecordedUrl(url);
      setLiveCapturedResult({
        durationSeconds: captured.durationSeconds,
        segments: captured.segments,
        fullTranscript: captured.fullTranscript,
        summary: captured.summary,
        language: captured.language,
        modelArch: captured.modelArch,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to finalize live recording.');
    }
  };

  // Save captured live recording & push blocks straight into the Chat stream
  const transcribeRecordedAudio = async () => {
    if (!recordedBlob) return;

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage(
        'Audio credit limit reached (0 minutes left). Please upgrade your subscription plan.'
      );
      return;
    }

    const recName = `Live Voice Recording (${new Date().toLocaleTimeString()})`;
    setActiveSourceLabel(recName);
    setActiveSourceType('record');
    setIsLoading(true);
    setErrorMessage(null);
    onTranscriptionStart?.(recName, 'record');

    try {
      let finalResult = liveCapturedResult;
      if (!finalResult || !finalResult.fullTranscript.trim()) {
        finalResult = await transcribeAudioFileWithMoonshine({
          fileOrBlob: recordedBlob,
          language: selectedSttLanguage,
          arch: selectedSttArch,
          onProgress: (prog) => setDownloadProgress(prog),
          onStage: (stage) => setLoadingStep(stage),
          onChunkProgress: (prog) => setChunkProgress(prog),
          onPartialSegments: (segs) => onPartialSegments?.(segs),
        });
      }

      const processed = await preparePlayableAudio(
        recordedBlob,
        `${recName}.wav`,
        finalResult.durationSeconds || recordingSeconds || 10
      );

      await persistTranscriptAndOpen({
        blob: processed.blob,
        audioName: recName,
        size: processed.blob.size,
        durationSeconds: processed.duration || finalResult.durationSeconds,
        mimeType: processed.mimeType || 'audio/wav',
        playableUrl: processed.url,
        segments: finalResult.segments,
        fullTranscript: finalResult.fullTranscript,
        summary: finalResult.summary,
        language: finalResult.language,
        modelArch: finalResult.modelArch,
      });

      // Reset live buffer after pushing into chat stream
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setLiveCapturedResult(null);
      setLiveCommittedLines([]);
      setLivePartialText('');
      setRecordingSeconds(0);
      setIsLoading(false);
      setDownloadProgress(null);
      setChunkProgress(null);
    } catch (err: unknown) {
      if (err instanceof MoonshineSttCancelledError) {
        setIsLoading(false);
        setDownloadProgress(null);
        setChunkProgress(null);
        onTranscriptionAbort?.();
        return;
      }
      const rawMsg = err instanceof Error ? err.message : 'Failed to finalize recording.';
      const { message } = sanitizeErrorMessage(rawMsg);
      setErrorMessage(message);
      setIsLoading(false);
      setDownloadProgress(null);
      setChunkProgress(null);
    }
  };

  const selectedLangOption = getLanguageOption(selectedSttLanguage);
  const showTopStage = Boolean(
    isLoading ||
      (activeMode === 'record' && (isStartingMic || isRecording || recordedBlob))
  );

  return (
    <div
      id="studio-chat-composer"
      onDragOver={(e) => {
        if (isLoading || activeMode !== 'upload') return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (activeMode !== 'upload') return;
        handleDrop(e);
      }}
      className={`max-w-3xl mx-auto w-full rounded-2xl bg-[#181818] border shadow-[0_10px_32px_rgba(0,0,0,0.48)] px-3 py-2.5 space-y-2.5 transition-colors ${
        dragOver ? 'border-[#3fb970] bg-[#1db954]/5' : 'border-[#2e3138]'
      }`}
    >
      {/* Cross-Origin Isolation Warning if running inside non-isolated embedded iframe */}
      {needsStandaloneTab && (
        <div className="p-2.5 bg-amber-950/30 border border-amber-700/60 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold">Browser Isolation Needed:</strong> Open Scriby in a standalone tab for multi-threaded WebAssembly execution.
            </span>
          </div>
          {typeof window !== 'undefined' && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-semibold rounded-lg text-xs shrink-0 whitespace-nowrap"
            >
              <span>Open Standalone Tab</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Credit Exceeded or Runtime Error Alert */}
      {errorMessage && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isCreditExceeded && onOpenPricing && (
              <button
                type="button"
                onClick={onOpenPricing}
                className="px-3 py-1 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-bold rounded text-xs whitespace-nowrap cursor-pointer"
              >
                Upgrade Plan
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="p-1 text-red-300/80 hover:text-red-100 rounded cursor-pointer"
              aria-label="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target.files?.[0]) {
            processAudioFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Active Processing / Live Mic Status Stage (Only shown when active) */}
      {showTopStage && (
        isLoading ? (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#131417] border border-[#262930]">
            <div className="flex items-center gap-3 min-w-0">
              <Loader2 className="w-4 h-4 text-[#3fb970] animate-spin shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#e4e7ec] truncate">
                  {loadingStep || 'Processing audio in isolated Moonshine worker...'}
                </div>
                {chunkProgress && chunkProgress.totalChunks > 1 ? (
                  <div className="text-[11px] font-mono tabular-nums text-[#9ca3af] mt-0.5">
                    Segment {chunkProgress.currentChunk}/{chunkProgress.totalChunks} ·{' '}
                    {formatPlayerTime(chunkProgress.processedSeconds)} /{' '}
                    {formatPlayerTime(chunkProgress.totalSeconds)} ·{' '}
                    {Math.round(chunkProgress.fraction * 100)}%
                  </div>
                ) : downloadProgress && downloadProgress.fraction >= 0 && downloadProgress.fraction < 1 ? (
                  <div className="text-[11px] font-mono tabular-nums text-[#9ca3af] mt-0.5">
                    Caching {downloadProgress.file}: {formatBytesMb(downloadProgress.loadedBytes)} /{' '}
                    {formatBytesMb(downloadProgress.totalBytes)}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                abortActiveSttSession();
                setIsLoading(false);
                setDownloadProgress(null);
                setChunkProgress(null);
                onTranscriptionAbort?.();
              }}
              className="px-3 py-1 bg-[#202227] hover:bg-[#2a2d34] text-[#d0d5dd] text-xs font-semibold rounded-lg border border-[#32363f] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-2.5 rounded-xl bg-[#131417] border border-[#262930] flex flex-col sm:flex-row items-center justify-between gap-3">
            {isStartingMic ? (
              <div className="flex items-center gap-2.5 text-xs text-[#e4e7ec] w-full">
                <Loader2 className="w-4 h-4 text-[#3fb970] animate-spin shrink-0" />
                <span>{loadingStep}</span>
              </div>
            ) : isRecording ? (
              <div className="flex items-center gap-3 min-w-0 w-full">
                <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono tabular-nums font-bold text-red-400">
                      {formatPlayerTime(recordingSeconds)}
                    </span>
                    <span className="text-[#9ca3af] truncate">
                      Streaming live ({selectedLangOption?.label || 'English'})...
                    </span>
                  </div>
                  {livePartialText && (
                    <div className="text-[11px] text-[#d0d5dd] italic truncate">
                      {livePartialText}
                    </div>
                  )}
                </div>
              </div>
            ) : recordedBlob ? (
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-3 w-full flex-1 min-w-0">
                  {recordedUrl && (
                    <audio controls src={recordedUrl} className="h-8 flex-1 min-w-[180px]" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                    setRecordedBlob(null);
                    setRecordedUrl(null);
                    setLiveCapturedResult(null);
                    setLiveCommittedLines([]);
                    setLivePartialText('');
                    setRecordingSeconds(0);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202227] hover:bg-[#2a2d34] text-[#d0d5dd] text-xs font-medium rounded-lg border border-[#32363f] whitespace-nowrap cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            ) : null}
          </div>
        )
      )}

      {/* Claude Code Bottom Control Bar: Mode + Language + Model Left, Action CTA Right */}
      <div className={`${showTopStage ? 'pt-2 border-t border-[#24262c]' : ''} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#121316] rounded-lg border border-[#282a30]">
            <button
              type="button"
              disabled={isLoading || isRecording || isStartingMic}
              onClick={() => setActiveMode('upload')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                activeMode === 'upload'
                  ? 'bg-[#1db954]/15 text-[#4cc37c]'
                  : 'text-[#9ca3af] hover:text-[#d0d5dd]'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Upload Audio</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setActiveMode('record')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                activeMode === 'record'
                  ? 'bg-[#1db954]/15 text-[#4cc37c]'
                  : 'text-[#9ca3af] hover:text-[#d0d5dd]'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Mic</span>
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-[#121316] border border-[#282a30] rounded-lg px-2.5 h-7">
            <Globe className="w-3.5 h-3.5 text-[#3fb970] shrink-0" />
            <select
              aria-label="Speech Language"
              value={selectedSttLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isLoading || isRecording || isStartingMic}
              className="bg-transparent text-xs text-[#e4e7ec] outline-none disabled:opacity-60 cursor-pointer"
            >
              {sttLanguages.map((lang) => (
                <option
                  key={lang.code}
                  value={lang.code}
                  disabled={!lang.sttSupported}
                  className="bg-[#181818]"
                >
                  {lang.nativeName ? `${lang.label} (${lang.nativeName})` : lang.label}
                  {!lang.sttSupported ? ' — pending' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Model Arch Selector */}
          {selectedSttLanguage === 'en' ? (
            <div className="flex items-center gap-1.5 bg-[#121316] border border-[#282a30] rounded-lg px-2.5 h-7">
              <Cpu className="w-3.5 h-3.5 text-[#3fb970] shrink-0" />
              <select
                aria-label="WASM Model Architecture"
                value={selectedSttArch}
                onChange={(e) => setSelectedSttArch(e.target.value as MoonshineArchKey)}
                disabled={isLoading || isRecording || isStartingMic}
                className="bg-transparent text-xs text-[#e4e7ec] outline-none disabled:opacity-60 cursor-pointer"
              >
                {ENGLISH_ARCH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#181818]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="h-7 bg-[#121316] border border-[#282a30] text-xs text-[#d0d5dd] rounded-lg px-2.5 flex items-center gap-1.5 whitespace-nowrap">
              <Cpu className="w-3.5 h-3.5 text-[#3fb970]" />
              <span>{selectedLangOption?.sttModelLabel || 'Base'}</span>
            </div>
          )}
        </div>

        {/* Right Primary Action Slot */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {!isLoading && activeMode === 'upload' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Attach Audio</span>
            </button>
          )}

          {!isLoading && activeMode === 'record' && !isRecording && !recordedBlob && !isStartingMic && (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Start Mic</span>
            </button>
          )}

          {!isLoading && activeMode === 'record' && isRecording && (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-[#f3f4f6] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Recording</span>
            </button>
          )}

          {!isLoading && activeMode === 'record' && recordedBlob && (
            <button
              type="button"
              onClick={transcribeRecordedAudio}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add to Stream</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
