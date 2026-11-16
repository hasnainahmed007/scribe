import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Mic,
  Square,
  Play,
  RotateCcw,
  Sparkles,
  FileAudio,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { SAMPLE_AUDIOS, generateSyntheticAudioBlob } from '../data/sampleAudios';
import { TranscriptSegment, AudioSource } from '../types';
import { formatPlayerTime } from '../utils/timeFormat';
import { preparePlayableAudio } from '../utils/audioProcessing';
import { cacheTranscriptAudio } from '../utils/audioStorage';
import { useAuth } from '../context/AuthContext';
import { safeFetchJson, isQuotaExceededError, sanitizeErrorMessage, SAAS_AI_QUOTA_MESSAGE } from '../utils/apiClient';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AiQuotaNotice } from './AiQuotaNotice';

interface AudioInputHubProps {
  onTranscriptionComplete: (
    audioSource: AudioSource,
    segments: TranscriptSegment[],
    fullTranscript: string,
    summary: string
  ) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  onOpenPricing?: () => void;
  onQuotaExceeded?: (message: string) => void;
}

export const AudioInputHub: React.FC<AudioInputHubProps> = ({
  onTranscriptionComplete,
  isLoading,
  setIsLoading,
  onOpenPricing,
  onQuotaExceeded,
}) => {
  const { token, user, refreshProfile } = useAuth();
  const [activeMode, setActiveMode] = useState<'samples' | 'upload' | 'record'>('samples');
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [isCreditExceeded, setIsCreditExceeded] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  // Handle File Upload
  const processAudioFile = async (file: File) => {
    setErrorMessage(null);
    setIsCreditExceeded(false);

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage('Audio credit limit reached (0 minutes left). Please upgrade your subscription plan to transcribe audio.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Converting audio to binary format...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const cleanBase64 = base64Data.split(',')[1] || base64Data;

          setLoadingStep('Analyzing speech and aligning subtitle timestamps...');

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await safeFetchJson<{
            success: boolean;
            data: { segments: TranscriptSegment[]; fullTranscript: string; summary?: string };
            error?: string;
          }>('/api/transcribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              audioBase64: cleanBase64,
              mimeType: file.type || 'audio/mp3',
              contextHint: file.name,
              estimatedDurationSeconds: 60,
            }),
          });

          if (res.status === 403) {
            setIsCreditExceeded(true);
            throw new Error(res.error || res.data?.error || 'Credit limit reached. Please upgrade your subscription plan.');
          }

          if (res.isQuotaExceeded || res.status === 429) {
            setIsQuotaError(true);
            const msg = res.error || SAAS_AI_QUOTA_MESSAGE;
            onQuotaExceeded?.(msg);
            throw new Error(msg);
          }

          if (!res.ok || !res.data?.success) {
            throw new Error(res.error || res.data?.error || 'Failed to transcribe audio. Please try again.');
          }

          const json = res.data;
          setLoadingStep('Syncing audio timeline and wave playback...');

          const fallbackEnd =
            json.data.segments && json.data.segments.length > 0
              ? json.data.segments[json.data.segments.length - 1].end
              : 60;

          // Process and decode audio with universal WAV conversion for .ogg / .opus files
          const processed = await preparePlayableAudio(file, file.name, fallbackEnd);

          // Persist in local client audio vault and sync to server for permanent zero-latency playback
          try {
            const savedId = (json.data as any)?.savedTranscriptId;
            await cacheTranscriptAudio(savedId, file.name, processed.blob);
            if (savedId) {
              const readerWav = new FileReader();
              readerWav.onload = async () => {
                const b64 = (readerWav.result as string).split(',')[1];
                await safeFetchJson(`/api/audio/${savedId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    audioBase64: b64,
                    mimeType: processed.mimeType || 'audio/wav',
                    filename: file.name,
                  }),
                });
              };
              readerWav.readAsDataURL(processed.blob);
            }
          } catch (storageErr) {
            console.warn('[AudioVault] Could not cache uploaded audio locally:', storageErr);
          }

          onTranscriptionComplete(
            {
              url: processed.url,
              name: file.name,
              size: file.size,
              duration: processed.duration,
              blob: processed.blob,
              mimeType: processed.mimeType,
            },
            json.data.segments,
            json.data.fullTranscript,
            json.data.summary || ''
          );
          setIsLoading(false);
          refreshProfile();
        } catch (err: any) {
          const quota = isQuotaExceededError(err);
          const { message, isQuota } = sanitizeErrorMessage(err?.message || 'Audio conversion failed.');
          if (quota || isQuota) {
            setIsQuotaError(true);
            onQuotaExceeded?.(message);
          }
          setErrorMessage(message);
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not read file.');
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage('Audio credit limit reached (0 minutes left). Please upgrade your subscription plan to continue.');
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAudioFile(e.dataTransfer.files[0]);
    }
  };

  // Start Mic Recording
  const startRecording = async () => {
    setErrorMessage(null);
    setIsCreditExceeded(false);

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage('Audio credit limit reached (0 minutes left). Please upgrade your subscription plan to record and transcribe audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setRecordedBlob(audioBlob);
        setRecordedUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMessage('Microphone access denied. Please grant microphone permissions in browser.');
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Process Recorded Audio
  const transcribeRecordedAudio = async () => {
    if (!recordedBlob) return;

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage('Audio credit limit reached (0 minutes left). Please upgrade your subscription plan.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Transcribing spoken audio with universal speech model...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await safeFetchJson<{
            success: boolean;
            data: { segments: TranscriptSegment[]; fullTranscript: string; summary?: string };
            error?: string;
          }>('/api/transcribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: 'audio/webm',
              contextHint: 'Live microphone voice recording',
              estimatedDurationSeconds: recordingSeconds || 30,
            }),
          });

          if (res.status === 403) {
            setIsCreditExceeded(true);
            throw new Error(res.error || res.data?.error || 'Credit limit reached. Please upgrade your plan.');
          }

          if (res.isQuotaExceeded || res.status === 429) {
            setIsQuotaError(true);
            const msg = res.error || SAAS_AI_QUOTA_MESSAGE;
            onQuotaExceeded?.(msg);
            throw new Error(msg);
          }

          if (!res.ok || !res.data?.success) {
            throw new Error(res.error || res.data?.error || 'Failed to transcribe recording.');
          }

          const json = res.data;
          setLoadingStep('Syncing audio timeline and wave playback...');

          const fallbackEnd =
            json.data.segments && json.data.segments.length > 0
              ? json.data.segments[json.data.segments.length - 1].end
              : recordingSeconds > 0
              ? recordingSeconds
              : 30;

          const recName = `Live Voice Recording (${new Date().toLocaleTimeString()})`;
          const processed = await preparePlayableAudio(
            recordedBlob,
            `${recName}.wav`,
            fallbackEnd
          );

          try {
            const savedId = (json.data as any)?.savedTranscriptId;
            await cacheTranscriptAudio(savedId, recName, processed.blob);
            if (savedId) {
              const readerRec = new FileReader();
              readerRec.onload = async () => {
                const b64 = (readerRec.result as string).split(',')[1];
                await safeFetchJson(`/api/audio/${savedId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    audioBase64: b64,
                    mimeType: processed.mimeType || 'audio/wav',
                    filename: recName,
                  }),
                });
              };
              readerRec.readAsDataURL(processed.blob);
            }
          } catch (storageErr) {
            console.warn('[AudioVault] Could not cache recorded voice locally:', storageErr);
          }

          onTranscriptionComplete(
            {
              url: processed.url,
              name: recName,
              duration: processed.duration,
              blob: processed.blob,
              mimeType: processed.mimeType,
            },
            json.data.segments,
            json.data.fullTranscript,
            json.data.summary || ''
          );
          setIsLoading(false);
          refreshProfile();
        } catch (err: any) {
          const quota = isQuotaExceededError(err);
          const { message, isQuota } = sanitizeErrorMessage(err?.message || 'Failed to transcribe recording.');
          if (quota || isQuota) {
            setIsQuotaError(true);
            onQuotaExceeded?.(message);
          }
          setErrorMessage(message);
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(recordedBlob);
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsLoading(false);
    }
  };

  // Load Preset Sample
  const loadSample = (sample: typeof SAMPLE_AUDIOS[0]) => {
    setErrorMessage(null);

    if (user && user.creditsRemaining <= 0) {
      setIsCreditExceeded(true);
      setErrorMessage('Audio credit limit reached (0 minutes left). Please upgrade your subscription plan.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Loading demo sample and synchronized subtitle segments...');

    setTimeout(() => {
      const blob = generateSyntheticAudioBlob(sample.duration);
      const url = URL.createObjectURL(blob);
      onTranscriptionComplete(
        {
          url,
          name: sample.title,
          duration: sample.duration,
          blob,
          mimeType: 'audio/wav',
          isSample: true,
        },
        sample.segments,
        sample.fullTranscript,
        sample.summary
      );
      setIsLoading(false);
    }, 450);
  };

  return (
    <Card className="p-6 relative overflow-hidden shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#282828]">
        <div>
          <h2 className="text-xl font-bold text-[#e4e7ec] tracking-tight font-display flex items-center gap-2">
            Audio Input & Speech Studio
            <Badge variant="emerald">
              Universal Speech-to-Text
            </Badge>
          </h2>
          <p className="text-xs text-[#9ca3af] mt-1">
            Upload any audio/video file in any language or speak directly into your microphone.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 p-1 bg-[#141414] rounded-lg border border-[#282828] self-start md:self-auto">
          <button
            onClick={() => setActiveMode('samples')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeMode === 'samples'
                ? 'bg-[#1db954]/15 text-[#4cc37c] shadow-sm border border-[#1db954]/30'
                : 'text-[#9ca3af] hover:text-[#d0d5dd]'
            }`}
          >
            Demo Clips
          </button>
          <button
            onClick={() => setActiveMode('upload')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-[#1db954]/15 text-[#4cc37c] shadow-sm border border-[#1db954]/30'
                : 'text-[#9ca3af] hover:text-[#d0d5dd]'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveMode('record')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeMode === 'record'
                ? 'bg-[#1db954]/15 text-[#4cc37c] shadow-sm border border-[#1db954]/30'
                : 'text-[#9ca3af] hover:text-[#d0d5dd]'
            }`}
          >
            Live Mic
          </button>
        </div>
      </div>

      {/* Credit Exceeded, AI Quota Exceeded, or Error Alert */}
      {errorMessage && (
        isQuotaError ? (
          <div className="mt-4">
            <AiQuotaNotice
              message={errorMessage}
              onDismiss={() => {
                setErrorMessage(null);
                setIsQuotaError(false);
              }}
              onOpenPricing={onOpenPricing}
            />
          </div>
        ) : (
          <div className="mt-4 p-4 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice:</span> {errorMessage}
              </div>
            </div>
            {isCreditExceeded && onOpenPricing && (
              <button
                onClick={onOpenPricing}
                className="px-3 py-1 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] font-bold rounded text-xs shrink-0 whitespace-nowrap shadow-sm cursor-pointer"
              >
                Upgrade Plan
              </button>
            )}
          </div>
        )
      )}

      {/* Loading Overlay State */}
      {isLoading ? (
        <div className="py-14 text-center flex flex-col items-center justify-center">
          <div className="mb-5">
            <Loader2 className="w-11 h-11 text-[#3fb970] animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-[#e4e7ec] mb-2 font-display">
            Transcribing Spoken Audio...
          </h3>
          <p className="text-sm text-[#3fb970] font-medium">{loadingStep}</p>
          <div className="mt-6 flex items-center gap-3 text-xs text-[#9ca3af]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb970]" /> Audio Received
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb970]" /> Grammar & Punctuation
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb970]" /> Timestamp Sync
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {/* Mode 1: Pre-loaded Samples */}
          {activeMode === 'samples' && (
            <div>
              <div className="text-xs text-[#9ca3af] mb-3 flex items-center justify-between">
                <span>Select a demo clip for instant one-click testing:</span>
                <span className="text-[#3fb970] font-medium">Free instant demo</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_AUDIOS.map((sample) => (
                  <div
                    key={sample.id}
                    className="p-4 rounded-xl bg-[#181818] border border-[#282828] hover:border-[#1db954]/45 transition-all flex flex-col justify-between group cursor-pointer hover:bg-[#1f1f1f]"
                    onClick={() => loadSample(sample)}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5 text-[#9ca3af]">
                        <span className="text-[#3fb970] font-medium">{sample.category}</span>
                        <span className="font-mono tabular-nums">{sample.durationFormatted}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-[#e4e7ec] group-hover:text-[#4cc37c] transition-colors font-display line-clamp-1">
                        {sample.title}
                      </h4>
                      <p className="text-xs text-[#9ca3af] mt-1.5 line-clamp-2">
                        {sample.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#282828] flex items-center justify-between">
                      <span className="text-[11px] text-[#6f7682]">
                        {sample.segments.length} Timed Subtitle Blocks
                      </span>
                      <button className="flex items-center gap-1.5 px-3 py-1 bg-[#1db954]/10 hover:bg-[#1db954]/20 text-[#4cc37c] text-xs font-semibold rounded-lg border border-[#1db954]/25 transition-colors cursor-pointer">
                        <Play className="w-3 h-3 fill-current" />
                        <span>Load Sample</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: Audio File Upload */}
          {activeMode === 'upload' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-[#3fb970] bg-[#1db954]/10'
                    : 'border-[#2c2c2c] hover:border-[#3c3c3c] bg-[#141414] hover:bg-[#1a1a1a]'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'audio/*,video/mp4,video/webm';
                  input.onchange = (e: any) => {
                    if (e.target.files?.[0]) processAudioFile(e.target.files[0]);
                  };
                  input.click();
                }}
              >
                <div className="w-12 h-12 rounded-full bg-[#1db954]/10 text-[#3fb970] flex items-center justify-center mx-auto mb-3 border border-[#1db954]/20">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-[#e4e7ec] mb-1 font-display">
                  Drag and drop audio file or browse from device
                </h4>
                <p className="text-xs text-[#9ca3af] max-w-sm mx-auto">
                  Supports MP3, WAV, M4A, AAC, WebM, OGG (up to 50MB)
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#242424] hover:bg-[#2c2c2c] text-[#d0d5dd] text-xs font-medium rounded-lg transition-colors border border-[#323232]">
                  <FileAudio className="w-3.5 h-3.5 text-[#3fb970]" />
                  <span>Browse Audio File</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Live Mic Recording */}
          {activeMode === 'record' && (
            <div className="p-6 rounded-xl bg-[#141414] border border-[#282828] text-center flex flex-col items-center">
              <div className="mb-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
                    isRecording
                      ? 'bg-red-500/20 text-red-400 border-2 border-red-500 animate-pulse'
                      : 'bg-[#1db954]/10 text-[#3fb970] border border-[#1db954]/20'
                  }`}
                >
                  <Mic className="w-8 h-8" />
                </div>
              </div>

              {isRecording ? (
                <div>
                  <div className="text-2xl font-mono tabular-nums font-bold text-red-400 mb-2">
                    {formatPlayerTime(recordingSeconds)}
                  </div>
                  <p className="text-xs text-[#9ca3af] mb-5">
                    Recording voice... Speak clearly in any language into your mic.
                  </p>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-[#f3f4f6] text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Recording</span>
                  </button>
                </div>
              ) : recordedBlob ? (
                <div className="w-full max-w-md">
                  <div className="text-sm font-semibold text-[#e4e7ec] mb-1">
                    Recording Finished ({formatPlayerTime(recordingSeconds)})
                  </div>
                  <p className="text-xs text-[#9ca3af] mb-4">
                    Click below to transcribe this recording into text and timed subtitles.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={transcribeRecordedAudio}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-semibold rounded-lg transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Transcribe Audio</span>
                    </button>
                    <button
                      onClick={() => {
                        setRecordedBlob(null);
                        setRecordedUrl(null);
                        setRecordingSeconds(0);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-[#242424] hover:bg-[#2c2c2c] text-[#d0d5dd] text-xs font-medium rounded-lg border border-[#323232] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Record Again</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-semibold text-[#e4e7ec] mb-1 font-display">
                    Speak Directly Into Your Microphone
                  </h4>
                  <p className="text-xs text-[#9ca3af] mb-5 max-w-sm">
                    Record voice notes or speech in any language; our speech AI will segment sentences into timecodes.
                  </p>
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Start Recording</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
