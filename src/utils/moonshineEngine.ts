import type * as MoonshineWasm from '@moonshine-ai/moonshine-wasm';
import type { TranscriptSegment, VoiceProfile, VoiceTone } from '../types';
import {
  StructuredSubtitleCue,
  sanitizeSubtitleCueText,
  hasSpeakableText,
} from './subtitleUtils';
import {
  getLanguageOption,
  MoonshineArchKey,
  resolveMoonshineVoiceSelection,
} from './voiceLanguages';

export type MoonshineModuleNs = typeof MoonshineWasm;

export interface MoonshineDownloadProgress {
  fraction: number; // 0..1 when total is known, else -1
  loadedBytes: number;
  totalBytes?: number;
  file: string;
}

export interface MoonshineTranscriptionProgress {
  currentChunk: number;
  totalChunks: number;
  processedSeconds: number;
  totalSeconds: number;
  fraction: number; // 0..1
  activeArch: MoonshineArchKey;
  autoSwitchedFrom?: MoonshineArchKey;
  autoSwitchNotice?: string;
}

export interface MoonshineTranscriptionResult {
  language: string;
  modelArch: MoonshineArchKey;
  requestedModelArch?: MoonshineArchKey;
  autoSwitchedModel?: boolean;
  segments: TranscriptSegment[];
  fullTranscript: string;
  summary: string;
  durationSeconds: number;
  speakerCount: number;
  speakers: string[];
}

export interface MoonshineTtsResult {
  audioBlob: Blob;
  audioUrl: string;
  sampleRate: number;
  durationSeconds: number;
  voiceId: string;
  language: string;
  usedCloning: boolean;
  segments?: TranscriptSegment[];
}

export interface NaturalPhraseChunk {
  text: string;
  breakAfter: 'none' | 'clause' | 'sentence' | 'paragraph';
}

let moonshineNamespacePromise: Promise<MoonshineModuleNs> | null = null;
let cachedModuleInstance: MoonshineWasm.MoonshineModule | null = null;

let activeTranscriberCache: {
  key: string;
  language: string;
  arch: MoonshineArchKey;
  diarizationEnabled: boolean;
  instance: MoonshineWasm.Transcriber;
} | null = null;

let activeTtsCache: {
  key: string;
  instance: MoonshineWasm.TextToSpeech;
  cloningMode: boolean;
  lastCloneKey?: string;
} | null = null;

export class MoonshineSttCancelledError extends Error {
  public partialResult?: MoonshineTranscriptionResult;

  constructor(partialResult?: MoonshineTranscriptionResult) {
    super('Transcription cancelled.');
    this.name = 'MoonshineSttCancelledError';
    this.partialResult = partialResult;
  }
}

let activeSttAbortController: {
  cancelled: boolean;
  worker?: Worker | null;
  abortClient?: (() => void) | null;
} | null = null;

export function abortActiveSttSession(): boolean {
  if (!activeSttAbortController) return false;
  activeSttAbortController.cancelled = true;
  if (activeSttAbortController.abortClient) {
    try {
      activeSttAbortController.abortClient();
    } catch {}
    activeSttAbortController.abortClient = null;
  }
  if (activeSttAbortController.worker) {
    try {
      activeSttAbortController.worker.terminate();
    } catch {}
    activeSttAbortController.worker = null;
  }
  return true;
}

export function releaseCachedTranscriber(): void {
  if (activeTranscriberCache) {
    try {
      activeTranscriberCache.instance.close();
    } catch {}
    activeTranscriberCache = null;
  }
}

export function releaseCachedTts(): void {
  if (activeTtsCache) {
    try {
      activeTtsCache.instance.close();
    } catch {}
    activeTtsCache = null;
  }
}

export function isCrossOriginIsolatedReady(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

export class MoonshineIsolationError extends Error {
  constructor() {
    super(
      'WebAssembly multi-threading requires Cross-Origin Isolation (SharedArrayBuffer). Open Scriby in a standalone browser tab to enable local Moonshine AI execution.'
    );
    this.name = 'MoonshineIsolationError';
  }
}

function getWasmLocateFile(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `/moonshine-wasm/${clean}`;
}

export async function getMoonshineNamespace(): Promise<MoonshineModuleNs> {
  if (!moonshineNamespacePromise) {
    const wasmModulePath = '/moonshine-wasm/index.js';
    moonshineNamespacePromise = import(/* @vite-ignore */ wasmModulePath) as Promise<MoonshineModuleNs>;
  }
  return moonshineNamespacePromise;
}

export async function getMoonshineModule(): Promise<{
  ns: MoonshineModuleNs;
  mod: MoonshineWasm.MoonshineModule;
}> {
  if (!isCrossOriginIsolatedReady()) {
    throw new MoonshineIsolationError();
  }
  const ns = await getMoonshineNamespace();
  if (!cachedModuleInstance) {
    cachedModuleInstance = await ns.loadMoonshineModule({
      locateFile: getWasmLocateFile,
    });
  }
  return { ns, mod: cachedModuleInstance };
}

export function archKeyToModelArch(ns: MoonshineModuleNs, archKey: MoonshineArchKey): MoonshineWasm.ModelArch {
  switch (archKey) {
    case 'tiny':
      return ns.ModelArch.Tiny;
    case 'base':
      return ns.ModelArch.Base;
    case 'tiny_streaming':
      return ns.ModelArch.TinyStreaming;
    case 'small_streaming':
      return ns.ModelArch.SmallStreaming;
    case 'medium_streaming':
      return ns.ModelArch.MediumStreaming;
    default:
      return ns.ModelArch.MediumStreaming;
  }
}

export function resolveArchForLanguage(language: string, requestedArch?: MoonshineArchKey): MoonshineArchKey {
  const opt = getLanguageOption(language);
  const supported = opt?.availableSttArches || ['base'];
  if (requestedArch && supported.includes(requestedArch)) {
    return requestedArch;
  }
  return opt?.defaultSttArch || supported[0] || 'base';
}

export async function getOrLoadTranscriber(params: {
  language: string;
  arch?: MoonshineArchKey;
  enableDiarization?: boolean;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
}): Promise<{
  ns: MoonshineModuleNs;
  mod: MoonshineWasm.MoonshineModule;
  transcriber: MoonshineWasm.Transcriber;
  language: string;
  arch: MoonshineArchKey;
  diarizationEnabled: boolean;
}> {
  const { ns, mod } = await getMoonshineModule();
  const opt = getLanguageOption(params.language);
  if (!opt || !opt.sttSupported) {
    throw new Error(
      `Local speech-to-text pack for "${opt?.label || params.language}" is not bundled in this Moonshine WASM release yet. Please choose English, Spanish, Japanese, Arabic, Mandarin, Vietnamese, Korean, or Ukrainian.`
    );
  }

  const archKey = resolveArchForLanguage(opt.code, params.arch);
  const wantDiarization = params.enableDiarization !== false;
  const cacheKey = `${opt.code}:${archKey}:diar=${wantDiarization ? '1' : '0'}`;

  if (activeTranscriberCache && activeTranscriberCache.key === cacheKey) {
    params.onProgress?.({ fraction: 1, loadedBytes: 1, totalBytes: 1, file: 'cached' });
    return {
      ns,
      mod,
      transcriber: activeTranscriberCache.instance,
      language: opt.code,
      arch: archKey,
      diarizationEnabled: activeTranscriberCache.diarizationEnabled,
    };
  }

  // Free heavy TTS/ZipVoice ONNX graphs before loading STT models to prevent WASM OOM
  releaseCachedTts();
  releaseCachedTranscriber();

  const modelArch = archKeyToModelArch(ns, archKey);
  const handleProgress = (loaded: number, total: number | undefined, file: string) => {
    params.onProgress?.({
      fraction: total && total > 0 ? Math.min(1, loaded / total) : -1,
      loadedBytes: loaded,
      totalBytes: total,
      file,
    });
  };

  let transcriber: MoonshineWasm.Transcriber;
  let diarizationEnabled = false;

  if (wantDiarization) {
    try {
      transcriber = await ns.Transcriber.load({
        language: opt.code,
        modelArch,
        module: mod,
        moduleOptions: { locateFile: getWasmLocateFile },
        options: {
          identify_speakers: 'true',
          diarization_analyze_cadence: '0.5',
          diarization_cluster_cadence: '1.0',
          diarization_cluster_window_sec: '25.0',
        },
        onProgress: handleProgress,
      });
      diarizationEnabled = true;
    } catch (diarErr) {
      console.warn('[Moonshine STT] Diarization init fallback to base STT + acoustic diarization:', diarErr);
      transcriber = await ns.Transcriber.load({
        language: opt.code,
        modelArch,
        module: mod,
        moduleOptions: { locateFile: getWasmLocateFile },
        onProgress: handleProgress,
      });
    }
  } else {
    transcriber = await ns.Transcriber.load({
      language: opt.code,
      modelArch,
      module: mod,
      moduleOptions: { locateFile: getWasmLocateFile },
      onProgress: handleProgress,
    });
  }

  activeTranscriberCache = {
    key: cacheKey,
    language: opt.code,
    arch: archKey,
    diarizationEnabled,
    instance: transcriber,
  };

  return { ns, mod, transcriber, language: opt.code, arch: archKey, diarizationEnabled };
}

function resampleFloat32To16k(samples: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === 16000 || samples.length === 0) {
    return new Float32Array(samples);
  }
  const ratio = sourceRate / 16000;
  const outLength = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(samples.length - 1, idx0 + 1);
    const frac = srcIdx - idx0;
    out[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
  }
  return out;
}

/**
 * Fast, streaming pure-JS RIFF/WAV parser that reads PCM data in bounded 1 MB slices
 * directly into 16 kHz mono Float32Array without creating an AudioContext or holding
 * a duplicate multi-channel PCM AudioBuffer in RAM.
 * Returns null for non-WAV or compressed-in-WAV payloads so WebAudio handles them cleanly.
 */
export async function parseWavBlobTo16kMonoPcm(blob: Blob): Promise<{
  pcm16k: Float32Array;
  durationSeconds: number;
} | null> {
  if (blob.size < 44) return null;
  const headerSlice = await blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer();
  if (headerSlice.byteLength < 44) return null;

  const dv = new DataView(headerSlice);
  const readFourCC = (offset: number): string =>
    String.fromCharCode(
      dv.getUint8(offset),
      dv.getUint8(offset + 1),
      dv.getUint8(offset + 2),
      dv.getUint8(offset + 3)
    );

  if (readFourCC(0) !== 'RIFF' || readFourCC(8) !== 'WAVE') {
    return null;
  }

  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataByteLength = 0;

  let pos = 12;
  while (pos + 8 <= blob.size) {
    let chunkDv: DataView;
    if (pos + 8 <= headerSlice.byteLength) {
      chunkDv = new DataView(headerSlice, pos, Math.min(32, headerSlice.byteLength - pos));
    } else {
      const extraBuf = await blob.slice(pos, Math.min(blob.size, pos + 64)).arrayBuffer();
      if (extraBuf.byteLength < 8) break;
      chunkDv = new DataView(extraBuf);
    }

    const chunkId = String.fromCharCode(
      chunkDv.getUint8(0),
      chunkDv.getUint8(1),
      chunkDv.getUint8(2),
      chunkDv.getUint8(3)
    );
    const chunkSize = chunkDv.getUint32(4, true);
    const payloadStart = pos + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      if (payloadStart + 16 <= headerSlice.byteLength) {
        audioFormat = dv.getUint16(payloadStart, true);
        numChannels = dv.getUint16(payloadStart + 2, true);
        sampleRate = dv.getUint32(payloadStart + 4, true);
        bitsPerSample = dv.getUint16(payloadStart + 14, true);
      } else {
        const fmtBuf = await blob.slice(payloadStart, payloadStart + 16).arrayBuffer();
        const fdv = new DataView(fmtBuf);
        audioFormat = fdv.getUint16(0, true);
        numChannels = fdv.getUint16(2, true);
        sampleRate = fdv.getUint32(4, true);
        bitsPerSample = fdv.getUint16(14, true);
      }
    } else if (chunkId === 'data') {
      dataOffset = payloadStart;
      dataByteLength = Math.min(chunkSize, Math.max(0, blob.size - payloadStart));
      break;
    }

    const nextPos = payloadStart + chunkSize + (chunkSize % 2);
    if (nextPos <= pos) break;
    pos = nextPos;
  }

  // Only decode uncompressed PCM (1: int8/16/24/32) and IEEE float (3: float32)
  const validFormat =
    (audioFormat === 1 && (bitsPerSample === 8 || bitsPerSample === 16 || bitsPerSample === 24 || bitsPerSample === 32)) ||
    (audioFormat === 3 && bitsPerSample === 32);

  if (!validFormat || numChannels < 1 || sampleRate <= 0 || dataOffset < 0 || dataByteLength <= 0) {
    return null;
  }

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = bytesPerSample * numChannels;
  const totalFrames = Math.floor(dataByteLength / blockAlign);
  if (totalFrames <= 0) return null;

  const durationSeconds = Math.max(0.2, totalFrames / sampleRate);
  const outLength = Math.max(1, Math.round((totalFrames * 16000) / sampleRate));
  const pcm16k = new Float32Array(outLength);

  // Fast streaming pass in ~1 MB frame-aligned chunks
  const targetChunkBytes = 1024 * 1024;
  const framesPerRead = Math.max(1024, Math.floor(targetChunkBytes / blockAlign));
  let frameCursor = 0;
  let outIdx = 0;
  const step = sampleRate / 16000;

  while (frameCursor < totalFrames && outIdx < outLength) {
    const readFrames = Math.min(framesPerRead, totalFrames - frameCursor);
    const startByte = dataOffset + frameCursor * blockAlign;
    const endByte = startByte + readFrames * blockAlign;
    const chunkBuf = await blob.slice(startByte, endByte).arrayBuffer();
    const cdv = new DataView(chunkBuf);
    const chunkFrames = Math.floor(chunkBuf.byteLength / blockAlign);
    if (chunkFrames <= 0) break;

    const readMonoFrame = (localFrame: number): number => {
      let sum = 0;
      const base = localFrame * blockAlign;
      for (let c = 0; c < numChannels; c++) {
        const off = base + c * bytesPerSample;
        if (audioFormat === 3) {
          sum += cdv.getFloat32(off, true);
        } else if (bitsPerSample === 16) {
          sum += cdv.getInt16(off, true) / 32768;
        } else if (bitsPerSample === 8) {
          sum += (cdv.getUint8(off) - 128) / 128;
        } else if (bitsPerSample === 24) {
          let val = cdv.getUint8(off) | (cdv.getUint8(off + 1) << 8) | (cdv.getUint8(off + 2) << 16);
          if (val & 0x800000) val |= ~0xffffff;
          sum += val / 8388608;
        } else if (bitsPerSample === 32) {
          sum += cdv.getInt32(off, true) / 2147483648;
        }
      }
      return sum / numChannels;
    };

    const chunkEndGlobal = frameCursor + chunkFrames;
    while (outIdx < outLength) {
      const globalSrcIdx = outIdx * step;
      if (globalSrcIdx >= chunkEndGlobal - 1 && chunkEndGlobal < totalFrames) {
        break;
      }
      const localSrc = Math.max(0, Math.min(chunkFrames - 1, globalSrcIdx - frameCursor));
      const idx0 = Math.floor(localSrc);
      const idx1 = Math.min(chunkFrames - 1, idx0 + 1);
      const frac = localSrc - idx0;
      const s0 = readMonoFrame(idx0);
      const s1 = idx1 === idx0 ? s0 : readMonoFrame(idx1);
      pcm16k[outIdx] = s0 * (1 - frac) + s1 * frac;
      outIdx++;
    }

    // Back up 1 frame for smooth linear interpolation across read boundaries
    frameCursor = chunkEndGlobal < totalFrames ? chunkEndGlobal - 1 : chunkEndGlobal;
  }

  return { pcm16k, durationSeconds };
}

/**
 * Decodes any browser-supported audio/video Blob or File into mono 16 kHz Float32Array PCM
 * with minimal peak RAM: uses pure-JS streaming RIFF slice parsing for WAV, and a native
 * 16 kHz AudioContext (without duplicating rawBuffer) for MP3/M4A/AAC/OGG/WebM.
 */
export async function decodeBlobTo16kMonoPcm(blob: Blob): Promise<{
  pcm16k: Float32Array;
  durationSeconds: number;
}> {
  // Fast zero-AudioContext streaming decode for WAV files
  try {
    const wavResult = await parseWavBlobTo16kMonoPcm(blob);
    if (wavResult) {
      return wavResult;
    }
  } catch {
    // Fall through to WebAudio if header parsing fails
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is unavailable in this browser.');
  }

  // Requesting 16 kHz AudioContext reduces decoded AudioBuffer RAM by 3x (e.g. 68 MB instead of 204 MB for 8m51s stereo)
  let tempCtx: AudioContext;
  try {
    tempCtx = new AudioCtx({ sampleRate: 16000 });
  } catch {
    tempCtx = new AudioCtx();
  }

  try {
    const rawBuffer = await blob.arrayBuffer();
    // Pass rawBuffer directly (no .slice(0)) so WebAudio transfers/detaches without keeping two copies in RAM
    const decoded = await tempCtx.decodeAudioData(rawBuffer);
    const durationSeconds = Math.max(0.2, decoded.duration);

    if (decoded.sampleRate === 16000 && decoded.numberOfChannels === 1) {
      return {
        pcm16k: new Float32Array(decoded.getChannelData(0)),
        durationSeconds,
      };
    }

    const numChannels = Math.max(1, decoded.numberOfChannels);
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(decoded.getChannelData(c));
    }

    const srcRate = decoded.sampleRate;
    const srcLen = decoded.length;
    const invChannels = 1 / numChannels;

    if (srcRate === 16000) {
      const pcm16k = new Float32Array(srcLen);
      for (let i = 0; i < srcLen; i++) {
        let sum = 0;
        for (let c = 0; c < numChannels; c++) {
          sum += channels[c][i];
        }
        pcm16k[i] = sum * invChannels;
      }
      return { pcm16k, durationSeconds };
    }

    const ratio = srcRate / 16000;
    const outLength = Math.max(1, Math.round(srcLen / ratio));
    const pcm16k = new Float32Array(outLength);

    for (let i = 0; i < outLength; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(srcLen - 1, idx0 + 1);
      const frac = srcIdx - idx0;

      let s0 = 0;
      let s1 = 0;
      for (let c = 0; c < numChannels; c++) {
        const ch = channels[c];
        s0 += ch[idx0];
        s1 += ch[idx1];
      }
      pcm16k[i] = (s0 * (1 - frac) + s1 * frac) * invChannels;
    }

    return {
      pcm16k,
      durationSeconds,
    };
  } finally {
    if (tempCtx.state !== 'closed') {
      await tempCtx.close().catch(() => {});
    }
  }
}

export function float32PcmToWavBlob(pcm: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteLength = pcm.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Failed to encode audio payload.'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// MULTI-SPEAKER DIARIZATION HELPERS (SPAN SPLITTING + ACOUSTIC CLUSTERING)
// ============================================================================

function splitTextAtSentenceAndSilenceBoundaries(
  lineText: string,
  startTime: number,
  endTime: number,
  speaker: string,
  baseIndex: number,
  pcm16k?: Float32Array
): TranscriptSegment[] {
  const clean = lineText.trim();
  const totalDur = Math.max(0.6, endTime - startTime);

  // Split multi-sentence lines first so different speakers across sentences can be separated cleanly
  const sentenceParts = clean
    .split(/(?<=[.!?।。؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceParts.length > 1) {
    const totalChars = sentenceParts.reduce((sum, s) => sum + s.length, 0) || 1;
    const out: TranscriptSegment[] = [];
    let cursor = startTime;
    for (let i = 0; i < sentenceParts.length; i++) {
      const isLast = i === sentenceParts.length - 1;
      const dur = isLast ? Math.max(0.45, endTime - cursor) : Math.max(0.45, (sentenceParts[i].length / totalChars) * totalDur);
      const segEnd = isLast ? endTime : Math.min(endTime, cursor + dur);
      out.push(
        ...splitLongLineIntoSubtitleSegments(sentenceParts[i], cursor, segEnd, speaker, baseIndex * 10 + i + 1)
      );
      cursor = segEnd;
    }
    return out;
  }

  // If a single long unpunctuated line exceeds 4.5s and PCM has a clear internal pause (>=220ms), split at that pause
  const words = clean.split(/\s+/).filter(Boolean);
  if (pcm16k && totalDur >= 4.5 && words.length >= 10) {
    const startSample = Math.max(0, Math.floor(startTime * 16000));
    const endSample = Math.min(pcm16k.length, Math.floor(endTime * 16000));
    const winSamples = 320; // 20ms
    const minPauseWindows = 11; // 220ms
    let bestPauseMidSample = -1;
    let bestPauseLen = 0;
    let curRun = 0;

    for (let pos = startSample + 16000; pos < endSample - 16000; pos += winSamples) {
      let sq = 0;
      const limit = Math.min(endSample, pos + winSamples);
      for (let j = pos; j < limit; j++) sq += pcm16k[j] * pcm16k[j];
      const rms = Math.sqrt(sq / Math.max(1, limit - pos));
      if (rms < 0.012) {
        curRun += 1;
        if (curRun >= minPauseWindows && curRun > bestPauseLen) {
          bestPauseLen = curRun;
          bestPauseMidSample = pos - Math.floor((curRun * winSamples) / 2);
        }
      } else {
        curRun = 0;
      }
    }

    if (bestPauseMidSample > startSample && bestPauseMidSample < endSample) {
      const pauseTime = bestPauseMidSample / 16000;
      const ratio = Math.max(0.2, Math.min(0.8, (pauseTime - startTime) / totalDur));
      const splitWordIdx = Math.max(2, Math.min(words.length - 2, Math.round(words.length * ratio)));
      const firstText = words.slice(0, splitWordIdx).join(' ');
      const secondText = words.slice(splitWordIdx).join(' ');
      return [
        ...splitLongLineIntoSubtitleSegments(firstText, startTime, pauseTime, speaker, baseIndex * 10 + 1),
        ...splitLongLineIntoSubtitleSegments(secondText, pauseTime, endTime, speaker, baseIndex * 10 + 2),
      ];
    }
  }

  return splitLongLineIntoSubtitleSegments(clean, startTime, endTime, speaker, baseIndex);
}

function splitLongLineIntoSubtitleSegments(
  lineText: string,
  startTime: number,
  endTime: number,
  speaker: string,
  baseIndex: number
): TranscriptSegment[] {
  const clean = lineText.trim();
  const totalDur = Math.max(0.5, endTime - startTime);
  if (clean.length <= 95 && totalDur <= 7.5) {
    return [
      {
        id: `seg-ms-${Date.now()}-${baseIndex}`,
        start: Number(startTime.toFixed(2)),
        end: Number(endTime.toFixed(2)),
        speaker,
        text: clean,
      },
    ];
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 8) {
    return [
      {
        id: `seg-ms-${Date.now()}-${baseIndex}`,
        start: Number(startTime.toFixed(2)),
        end: Number(endTime.toFixed(2)),
        speaker,
        text: clean,
      },
    ];
  }

  const targetChunks = Math.max(2, Math.ceil(totalDur / 5.5));
  const wordsPerChunk = Math.max(3, Math.ceil(words.length / targetChunks));
  const out: TranscriptSegment[] = [];
  let cursorTime = startTime;

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const ratio = chunkWords.length / words.length;
    const chunkDur = Math.max(0.5, totalDur * ratio);
    const segEnd = i + wordsPerChunk >= words.length ? endTime : Math.min(endTime, cursorTime + chunkDur);

    out.push({
      id: `seg-ms-${Date.now()}-${baseIndex}-${out.length + 1}`,
      start: Number(cursorTime.toFixed(2)),
      end: Number(Math.max(cursorTime + 0.45, segEnd).toFixed(2)),
      speaker,
      text: chunkWords.join(' '),
    });
    cursorTime = segEnd;
  }

  return out;
}

interface AcousticDescriptor {
  segIdx: number;
  medianF0Hz: number;
  logF0: number;
  spectralCentroid: number;
  bandProfile: number[]; // 6 normalized spectral log bands
  voicedRatio: number;
}

const BAND_FREQS_HZ = [180, 380, 720, 1300, 2300, 4100];

function extractSegmentAcousticDescriptor(
  pcm16k: Float32Array,
  startSec: number,
  endSec: number,
  segIdx: number
): AcousticDescriptor | null {
  const startSample = Math.max(0, Math.floor(startSec * 16000));
  const endSample = Math.min(pcm16k.length, Math.floor(endSec * 16000));
  const len = endSample - startSample;
  if (len < 1600) return null; // < 100ms too short for reliable pitch/formant estimation

  const frameSize = 400; // 25ms @ 16kHz
  const hop = 160; // 10ms @ 16kHz
  const minLag = 44; // ~363 Hz max F0
  const maxLag = 230; // ~69.5 Hz min F0

  // Peak energy check
  let overallSq = 0;
  for (let i = startSample; i < endSample; i++) {
    overallSq += pcm16k[i] * pcm16k[i];
  }
  const overallRms = Math.sqrt(overallSq / len);
  if (overallRms < 0.005) return null;

  const activeThreshold = Math.max(0.006, overallRms * 0.25);
  const f0Values: number[] = [];
  const bandAccum = [0, 0, 0, 0, 0, 0];
  let voicedFrames = 0;
  let totalFrames = 0;

  for (let pos = startSample; pos + frameSize <= endSample; pos += hop) {
    totalFrames += 1;
    let sq = 0;
    let mean = 0;
    for (let i = 0; i < frameSize; i++) mean += pcm16k[pos + i];
    mean /= frameSize;

    for (let i = 0; i < frameSize; i++) {
      const v = pcm16k[pos + i] - mean;
      sq += v * v;
    }
    const frameRms = Math.sqrt(sq / frameSize);
    if (frameRms < activeThreshold) continue;

    voicedFrames += 1;

    // 1. Goertzel-like narrow filterbank at 6 characteristic vocal formant bands
    let bandTotal = 1e-9;
    for (let b = 0; b < BAND_FREQS_HZ.length; b++) {
      const omega = (2 * Math.PI * BAND_FREQS_HZ[b]) / 16000;
      const coeff = 2 * Math.cos(omega);
      let s1 = 0;
      let s2 = 0;
      for (let i = 0; i < 256; i++) {
        const s0 = (pcm16k[pos + i] - mean) + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      const mag = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
      const logE = Math.log1p(mag);
      bandAccum[b] += logE;
      bandTotal += logE;
    }
    void bandTotal;

    // 2. Normalized autocorrelation for fundamental pitch F0
    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag && lag < frameSize - 80; lag += 2) {
      let num = 0;
      let e0 = 0;
      let e1 = 0;
      const evalLen = frameSize - lag;
      for (let i = 0; i < evalLen; i++) {
        const x = pcm16k[pos + i] - mean;
        const y = pcm16k[pos + i + lag] - mean;
        num += x * y;
        e0 += x * x;
        e1 += y * y;
      }
      const denom = Math.sqrt(e0 * e1) + 1e-9;
      const corr = num / denom;
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    // Refine +/-1 sample around peak lag
    if (bestLag > minLag && bestCorr >= 0.40) {
      for (let lag = Math.max(minLag, bestLag - 1); lag <= Math.min(maxLag, bestLag + 1); lag++) {
        let num = 0;
        let e0 = 0;
        let e1 = 0;
        const evalLen = frameSize - lag;
        for (let i = 0; i < evalLen; i++) {
          const x = pcm16k[pos + i] - mean;
          const y = pcm16k[pos + i + lag] - mean;
          num += x * y;
          e0 += x * x;
          e1 += y * y;
        }
        const corr = num / (Math.sqrt(e0 * e1) + 1e-9);
        if (corr >= bestCorr) {
          bestCorr = corr;
          bestLag = lag;
        }
      }
      f0Values.push(16000 / bestLag);
    }
  }

  if (voicedFrames < 3) return null;

  // Compute median F0 if enough periodic voiced frames exist; otherwise estimate from low-band centroid
  f0Values.sort((a, b) => a - b);
  const medianF0Hz =
    f0Values.length >= 2
      ? f0Values[Math.floor(f0Values.length / 2)]
      : 150;

  const avgBands = bandAccum.map((v) => v / voicedFrames);
  const bandNorm = Math.sqrt(avgBands.reduce((s, v) => s + v * v, 0)) || 1;
  const bandProfile = avgBands.map((v) => v / bandNorm);

  let centroidNum = 0;
  let centroidDen = 1e-9;
  for (let b = 0; b < BAND_FREQS_HZ.length; b++) {
    centroidNum += BAND_FREQS_HZ[b] * avgBands[b];
    centroidDen += avgBands[b];
  }

  return {
    segIdx,
    medianF0Hz,
    logF0: Math.log2(Math.max(60, medianF0Hz)),
    spectralCentroid: centroidNum / centroidDen,
    bandProfile,
    voicedRatio: voicedFrames / Math.max(1, totalFrames),
  };
}

function descriptorDistance(a: AcousticDescriptor, b: AcousticDescriptor): number {
  const semitoneDiff = Math.abs(a.logF0 - b.logF0) * 12;
  let dot = 0;
  for (let i = 0; i < a.bandProfile.length; i++) {
    dot += a.bandProfile[i] * b.bandProfile[i];
  }
  const cosineDist = Math.max(0, 1 - Math.min(1, dot));
  const centroidDiff = Math.abs(a.spectralCentroid - b.spectralCentroid) / 550;
  // Combine vocal pitch (handles both Male/Female and distinct same-gender registers) + vocal tract formant shape
  return semitoneDiff * 0.34 + cosineDist * 9.5 + centroidDiff * 0.8;
}

function normalizeSpeakersChronologically(segments: TranscriptSegment[]): TranscriptSegment[] {
  const mapping = new Map<string, string>();
  let nextNum = 1;
  return segments.map((seg) => {
    const rawKey = (seg.speaker || 'Speaker 1').trim() || 'Speaker 1';
    let normalized = mapping.get(rawKey);
    if (!normalized) {
      normalized = `Speaker ${nextNum}`;
      nextNum += 1;
      mapping.set(rawKey, normalized);
    }
    return { ...seg, speaker: normalized };
  });
}

/**
 * Verifies speaker labels against real audio acoustics when Moonshine WASM's diarization
 * collapses multiple speakers into one speaker, or smooths noisy single-word diarization flips.
 */
export function refineSpeakersFromAudioPcm(
  segments: TranscriptSegment[],
  pcm16k?: Float32Array
): TranscriptSegment[] {
  if (segments.length === 0) return segments;
  if (!pcm16k || pcm16k.length < 3200) {
    return normalizeSpeakersChronologically(segments);
  }

  const nativeSpeakers = new Set(segments.map((s) => (s.speaker || 'Speaker 1').trim()));
  const descriptors: AcousticDescriptor[] = [];
  const descBySegIdx = new Map<number, AcousticDescriptor>();

  for (let i = 0; i < segments.length; i++) {
    const desc = extractSegmentAcousticDescriptor(pcm16k, segments[i].start, segments[i].end, i);
    if (desc) {
      descriptors.push(desc);
      descBySegIdx.set(i, desc);
    }
  }

  // Case 1: Native diarization already separated multiple speakers -> normalize & clean micro-flaps
  if (nativeSpeakers.size >= 2) {
    const cleaned = segments.map((seg) => ({ ...seg }));
    for (let i = 1; i < cleaned.length - 1; i++) {
      const prev = cleaned[i - 1];
      const curr = cleaned[i];
      const next = cleaned[i + 1];
      const dur = curr.end - curr.start;
      const words = curr.text.trim().split(/\s+/).filter(Boolean).length;
      if (
        prev.speaker === next.speaker &&
        curr.speaker !== prev.speaker &&
        dur < 0.7 &&
        words <= 2
      ) {
        const dCurr = descBySegIdx.get(i);
        const dPrev = descBySegIdx.get(i - 1);
        const dNext = descBySegIdx.get(i + 1);
        if (dCurr && dPrev && dNext) {
          const avgNeighborDist = (descriptorDistance(dCurr, dPrev) + descriptorDistance(dCurr, dNext)) / 2;
          if (avgNeighborDist < 1.1) {
            cleaned[i].speaker = prev.speaker;
          }
        }
      }
    }
    return normalizeSpeakersChronologically(cleaned);
  }

  // Case 2: Native diarization returned only 1 speaker across multiple segments -> cluster acoustically
  if (descriptors.length < 2) {
    return normalizeSpeakersChronologically(segments);
  }

  type Cluster = { items: AcousticDescriptor[] };
  const clusters: Cluster[] = descriptors.map((d) => ({ items: [d] }));

  const clusterDistance = (c1: Cluster, c2: Cluster): number => {
    // Average linkage distance
    let total = 0;
    let count = 0;
    for (const a of c1.items) {
      for (const b of c2.items) {
        total += descriptorDistance(a, b);
        count += 1;
      }
    }
    return total / Math.max(1, count);
  };

  // Merge closest clusters until inter-speaker threshold is reached
  const MERGE_THRESHOLD = 1.42;
  while (clusters.length > 1) {
    let bestI = -1;
    let bestJ = -1;
    let bestDist = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = clusterDistance(clusters[i], clusters[j]);
        if (dist < bestDist) {
          bestDist = dist;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestDist <= MERGE_THRESHOLD || clusters.length > 6) {
      if (bestI >= 0 && bestJ >= 0) {
        clusters[bestI].items.push(...clusters[bestJ].items);
        clusters.splice(bestJ, 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (clusters.length <= 1) {
    return normalizeSpeakersChronologically(segments);
  }

  // Sort clusters by chronological first appearance so Speaker 1 speaks first, Speaker 2 second, etc.
  clusters.sort((a, b) => {
    const minA = Math.min(...a.items.map((x) => x.segIdx));
    const minB = Math.min(...b.items.map((x) => x.segIdx));
    return minA - minB;
  });

  const segSpeakerMap = new Map<number, string>();
  clusters.forEach((cluster, idx) => {
    const label = `Speaker ${idx + 1}`;
    for (const item of cluster.items) {
      segSpeakerMap.set(item.segIdx, label);
    }
  });

  const out = segments.map((seg, idx) => ({
    ...seg,
    speaker:
      segSpeakerMap.get(idx) ||
      (idx > 0 ? segSpeakerMap.get(idx - 1) : undefined) ||
      'Speaker 1',
  }));

  return normalizeSpeakersChronologically(out);
}

export function buildLocalSummary(
  fullTranscript: string,
  durationSeconds: number,
  languageLabel: string,
  totalAudioDurationSeconds?: number
): string {
  const trimmed = fullTranscript.trim();
  if (!trimmed) {
    return `No intelligible speech detected in this ${Math.round(durationSeconds)}s audio clip.`;
  }
  const sentences = trimmed
    .split(/(?<=[.!?。؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const preview = sentences.slice(0, 2).join(' ');
  const clipped = preview.length > 210 ? `${preview.slice(0, 207)}...` : preview;
  if (
    typeof totalAudioDurationSeconds === 'number' &&
    totalAudioDurationSeconds > durationSeconds + 2
  ) {
    return `${languageLabel} partial transcript saved at ${Math.round(durationSeconds)}s of ${Math.round(totalAudioDurationSeconds)}s (${words} words). Key excerpt: ${clipped}`;
  }
  return `${languageLabel} transcript generated locally (${words} words, ${Math.round(durationSeconds)}s). Key excerpt: ${clipped}`;
}

function getRawSpeakerKeyFromSpan(span?: MoonshineWasm.SpeakerSpan): string {
  if (!span) return 'raw-0';
  if (typeof span.speakerIndex === 'number' && span.speakerIndex >= 0) {
    return `idx-${span.speakerIndex}`;
  }
  if (span.speakerId && String(span.speakerId).trim()) {
    return `id-${String(span.speakerId).trim()}`;
  }
  return 'raw-0';
}

export function mapMoonshineLinesToSegments(
  lines: readonly MoonshineWasm.TranscriptLine[],
  totalDurationSeconds: number,
  pcm16k?: Float32Array
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let idx = 1;

  for (const line of lines) {
    const text = (line.text || '').trim();
    if (!text) continue;
    const start = Math.max(0, Number.isFinite(line.startTime) ? line.startTime : 0);
    const rawDuration = Number.isFinite(line.duration) && line.duration > 0 ? line.duration : 2.5;
    const end = Math.min(Math.max(start + 0.5, totalDurationSeconds || start + rawDuration), start + rawDuration);

    const spans = Array.isArray(line.speakerSpans) ? line.speakerSpans : [];
    // Coalesce consecutive speakerSpans with the same speaker inside a single line
    const coalescedTurns: Array<{
      speakerKey: string;
      startTime: number;
      endTime: number;
      startChar: number;
      endChar: number;
    }> = [];

    for (const sp of spans) {
      const spKey = getRawSpeakerKeyFromSpan(sp);
      const spStart = Math.max(start, Number.isFinite(sp.startTime) ? sp.startTime : start);
      const spDur = Number.isFinite(sp.duration) && sp.duration > 0 ? sp.duration : 0.4;
      const spEnd = Math.min(end, Math.max(spStart + 0.3, spStart + spDur));
      const last = coalescedTurns[coalescedTurns.length - 1];
      if (last && last.speakerKey === spKey) {
        last.endTime = Math.max(last.endTime, spEnd);
        if (typeof sp.endChar === 'number' && sp.endChar > last.endChar) {
          last.endChar = sp.endChar;
        }
      } else {
        coalescedTurns.push({
          speakerKey: spKey,
          startTime: spStart,
          endTime: spEnd,
          startChar: typeof sp.startChar === 'number' ? sp.startChar : -1,
          endChar: typeof sp.endChar === 'number' ? sp.endChar : -1,
        });
      }
    }

    const distinctSpanKeys = new Set(coalescedTurns.map((t) => t.speakerKey));

    if (coalescedTurns.length > 1 && distinctSpanKeys.size > 1) {
      // Split text accurately across multi-speaker spans inside this line
      const words = text.split(/\s+/).filter(Boolean);
      const totalSpanDur = coalescedTurns.reduce((s, t) => s + Math.max(0.25, t.endTime - t.startTime), 0) || 1;
      let wordOffset = 0;

      let charCursor = 0;
      for (let tIdx = 0; tIdx < coalescedTurns.length; tIdx++) {
        const turn = coalescedTurns[tIdx];
        const isLastTurn = tIdx === coalescedTurns.length - 1;
        let sliceText = '';

        if (
          turn.startChar >= 0 &&
          turn.endChar > turn.startChar &&
          turn.endChar <= text.length
        ) {
          let sIdx = Math.max(charCursor, Math.min(text.length, turn.startChar));
          // Advance sIdx back to start of word if it landed inside a word (unless previous turn consumed it)
          while (sIdx > charCursor && sIdx < text.length && !/\s/.test(text[sIdx - 1]) && !/\s/.test(text[sIdx])) {
            sIdx--;
          }
          let eIdx = isLastTurn ? text.length : Math.max(sIdx, Math.min(text.length, turn.endChar));
          while (!isLastTurn && eIdx > sIdx && eIdx < text.length && !/\s/.test(text[eIdx]) && !/\s/.test(text[eIdx - 1])) {
            eIdx++;
          }
          sliceText = text.slice(sIdx, eIdx).trim();
          charCursor = eIdx;
          while (charCursor < text.length && /\s/.test(text[charCursor])) charCursor++;
        }

        if (!sliceText && words.length > 0 && wordOffset < words.length) {
          const share = Math.max(0.25, turn.endTime - turn.startTime) / totalSpanDur;
          const takeCount = isLastTurn
            ? words.length - wordOffset
            : Math.max(1, Math.min(words.length - wordOffset - (coalescedTurns.length - tIdx - 1), Math.round(words.length * share)));
          sliceText = words.slice(wordOffset, wordOffset + takeCount).join(' ').trim();
          wordOffset += takeCount;
        }

        if (!sliceText) continue;
        segments.push(
          ...splitLongLineIntoSubtitleSegments(
            sliceText,
            turn.startTime,
            isLastTurn ? end : Math.max(turn.startTime + 0.4, turn.endTime),
            turn.speakerKey,
            idx * 10 + tIdx + 1
          )
        );
      }
    } else {
      const speakerKey = coalescedTurns[0]?.speakerKey || 'raw-0';
      segments.push(
        ...splitTextAtSentenceAndSilenceBoundaries(text, start, end, speakerKey, idx, pcm16k)
      );
    }

    idx += 1;
  }

  return refineSpeakersFromAudioPcm(segments, pcm16k);
}

export interface AudioTranscriptionChunkWindow {
  index: number;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
}

/**
 * Selects a memory-safe Moonshine STT architecture before model loading.
 * - <= 2 min (120s): Uses user's selected architecture.
 * - 2..4 min (121..240s): Steps down Medium Streaming (~305 MB) to Small Streaming (~165 MB).
 * - > 4 min (> 240s, e.g. 8m51s or 60m+ files): Steps down heavy arches to Tiny Streaming (~51 MB)
 *   or Tiny (~44 MB), preventing ONNX Runtime BFCArena tab OOM crashes while running ~4x faster.
 */
export function selectMemorySafeSttArch(
  requestedArch: MoonshineArchKey | undefined,
  durationSeconds: number,
  language: string
): {
  arch: MoonshineArchKey;
  autoSwitchedFrom?: MoonshineArchKey;
  notice?: string;
} {
  const resolved = resolveArchForLanguage(language, requestedArch);
  const opt = getLanguageOption(language);
  const supported = opt?.availableSttArches || [resolved];

  if (durationSeconds > 240) {
    const ultraLight: MoonshineArchKey | undefined = supported.includes('tiny_streaming')
      ? 'tiny_streaming'
      : supported.includes('tiny')
      ? 'tiny'
      : undefined;

    if (ultraLight && resolved !== ultraLight) {
      return {
        arch: ultraLight,
        autoSwitchedFrom: resolved,
        notice: `Long audio (${Math.max(1, Math.round(durationSeconds / 60))} min): automatically using ${ultraLight.replace('_', ' ')} (~51 MB) for crash-free transcription.`,
      };
    }
  }

  if (durationSeconds > 120 && resolved === 'medium_streaming') {
    const lighter: MoonshineArchKey | undefined = supported.includes('small_streaming')
      ? 'small_streaming'
      : supported.includes('tiny_streaming')
      ? 'tiny_streaming'
      : supported.includes('base')
      ? 'base'
      : supported.find((a) => a !== 'medium_streaming');

    if (lighter) {
      return {
        arch: lighter,
        autoSwitchedFrom: resolved,
        notice: `Long audio (${Math.max(1, Math.round(durationSeconds / 60))} min): automatically using ${lighter.replace('_', ' ')} for safe memory usage.`,
      };
    }
  }

  return { arch: resolved };
}

/**
 * Splits long 16 kHz mono PCM arrays into ~18-second windows aligned on quiet speech pauses
 * so WASM tensor allocations stay small and constant regardless of total file duration.
 */
export function planAudioTranscriptionChunks(
  pcm16k: Float32Array,
  options?: {
    targetChunkSec?: number;
    minChunkSec?: number;
    maxChunkSec?: number;
    sampleRate?: number;
  }
): AudioTranscriptionChunkWindow[] {
  const sr = options?.sampleRate ?? 16000;
  const targetSec = options?.targetChunkSec ?? 18;
  const minSec = options?.minChunkSec ?? 10;
  const maxSec = options?.maxChunkSec ?? 24;

  const totalSamples = pcm16k.length;
  const totalSec = totalSamples / sr;

  if (totalSamples === 0) return [];
  if (totalSec <= maxSec) {
    return [
      {
        index: 0,
        startSample: 0,
        endSample: totalSamples,
        startTime: 0,
        endTime: Number(totalSec.toFixed(2)),
      },
    ];
  }

  const winSamples = Math.round(sr * 0.04); // 40ms scan frame
  const windows: AudioTranscriptionChunkWindow[] = [];
  let startSample = 0;

  while (startSample < totalSamples) {
    const remainingSec = (totalSamples - startSample) / sr;
    if (remainingSec <= maxSec) {
      windows.push({
        index: windows.length,
        startSample,
        endSample: totalSamples,
        startTime: Number((startSample / sr).toFixed(3)),
        endTime: Number((totalSamples / sr).toFixed(3)),
      });
      break;
    }

    const minEnd = startSample + Math.round(minSec * sr);
    const maxEnd = Math.min(totalSamples - Math.round(5 * sr), startSample + Math.round(maxSec * sr));
    const nominalEnd = Math.min(maxEnd, Math.max(minEnd, startSample + Math.round(targetSec * sr)));

    let bestCut = nominalEnd;
    let lowestEnergy = Infinity;

    const searchStart = Math.max(minEnd, nominalEnd - Math.round(4 * sr));
    const searchEnd = Math.min(maxEnd, nominalEnd + Math.round(4 * sr));

    for (let pos = searchStart; pos + winSamples <= searchEnd; pos += winSamples) {
      let sq = 0;
      for (let j = 0; j < winSamples; j += 2) {
        const v = pcm16k[pos + j];
        sq += v * v;
      }
      const rms = Math.sqrt(sq / (winSamples / 2));
      if (rms < lowestEnergy) {
        lowestEnergy = rms;
        bestCut = pos + Math.floor(winSamples / 2);
        if (rms < 0.008) break; // Clear silent pause found
      }
    }

    windows.push({
      index: windows.length,
      startSample,
      endSample: bestCut,
      startTime: Number((startSample / sr).toFixed(3)),
      endTime: Number((bestCut / sr).toFixed(3)),
    });
    startSample = bestCut;
  }

  return windows;
}

interface GlobalSpeakerVoiceprint {
  label: string;
  descriptor: AcousticDescriptor;
  totalDurationSec: number;
}

/**
 * Maintains consistent global speaker labels (Speaker 1, Speaker 2, Speaker 3, ...) across
 * independently transcribed audio chunks using pitch + 6-band spectral formant voiceprints.
 */
export class CrossChunkSpeakerRegistry {
  private speakers: GlobalSpeakerVoiceprint[] = [];
  private lastAssignedLabel = 'Speaker 1';

  public mapChunkSegments(
    chunkSegments: TranscriptSegment[],
    chunkPcm: Float32Array,
    timeOffsetSec: number,
    idOffset: number
  ): TranscriptSegment[] {
    if (chunkSegments.length === 0) return [];

    // Aggregate acoustic descriptors per local speaker inside this chunk
    const byLocal = new Map<string, { descs: AcousticDescriptor[]; dur: number }>();

    for (const seg of chunkSegments) {
      const localKey = (seg.speaker || 'Speaker 1').trim() || 'Speaker 1';
      let bucket = byLocal.get(localKey);
      if (!bucket) {
        bucket = { descs: [], dur: 0 };
        byLocal.set(localKey, bucket);
      }
      const dur = Math.max(0.2, seg.end - seg.start);
      bucket.dur += dur;
      const d = extractSegmentAcousticDescriptor(chunkPcm, seg.start, seg.end, 0);
      if (d) bucket.descs.push(d);
    }

    const localCentroids = new Map<string, { desc: AcousticDescriptor; dur: number }>();
    for (const [localKey, data] of byLocal.entries()) {
      if (data.descs.length === 0) continue;
      const n = data.descs.length;
      const avgBands = [0, 0, 0, 0, 0, 0];
      let sumLogF0 = 0;
      let sumF0 = 0;
      let sumCentroid = 0;
      let sumVoiced = 0;

      for (const d of data.descs) {
        sumLogF0 += d.logF0;
        sumF0 += d.medianF0Hz;
        sumCentroid += d.spectralCentroid;
        sumVoiced += d.voicedRatio;
        for (let b = 0; b < 6; b++) avgBands[b] += d.bandProfile[b];
      }

      const normBands = avgBands.map((v) => v / n);
      const bNorm = Math.sqrt(normBands.reduce((s, v) => s + v * v, 0)) || 1;

      localCentroids.set(localKey, {
        dur: data.dur,
        desc: {
          segIdx: 0,
          medianF0Hz: sumF0 / n,
          logF0: sumLogF0 / n,
          spectralCentroid: sumCentroid / n,
          bandProfile: normBands.map((v) => v / bNorm),
          voicedRatio: sumVoiced / n,
        },
      });
    }

    // Optimal 1-to-1 greedy distance matching so distinct local speakers never collapse onto one global label
    const localToGlobal = new Map<string, string>();
    const MATCH_THRESHOLD = 1.38;

    const pairs: Array<{ localKey: string; globalIdx: number; dist: number }> = [];
    for (const [localKey, localInfo] of localCentroids.entries()) {
      this.speakers.forEach((globalSp, globalIdx) => {
        pairs.push({
          localKey,
          globalIdx,
          dist: descriptorDistance(localInfo.desc, globalSp.descriptor),
        });
      });
    }
    pairs.sort((a, b) => a.dist - b.dist);

    const usedGlobals = new Set<number>();
    for (const p of pairs) {
      if (p.dist > MATCH_THRESHOLD) break;
      if (localToGlobal.has(p.localKey) || usedGlobals.has(p.globalIdx)) continue;

      const globalSp = this.speakers[p.globalIdx];
      const localInfo = localCentroids.get(p.localKey)!;
      localToGlobal.set(p.localKey, globalSp.label);
      usedGlobals.add(p.globalIdx);

      // Blend running voiceprint smoothly weighted by voiced duration
      const wOld = Math.min(25, globalSp.totalDurationSec);
      const wNew = Math.min(8, localInfo.dur);
      const wTotal = wOld + wNew || 1;
      const blendedBands = globalSp.descriptor.bandProfile.map(
        (v, b) => (v * wOld + localInfo.desc.bandProfile[b] * wNew) / wTotal
      );
      const bNorm = Math.sqrt(blendedBands.reduce((s, v) => s + v * v, 0)) || 1;

      globalSp.descriptor = {
        ...globalSp.descriptor,
        medianF0Hz: (globalSp.descriptor.medianF0Hz * wOld + localInfo.desc.medianF0Hz * wNew) / wTotal,
        logF0: (globalSp.descriptor.logF0 * wOld + localInfo.desc.logF0 * wNew) / wTotal,
        spectralCentroid:
          (globalSp.descriptor.spectralCentroid * wOld + localInfo.desc.spectralCentroid * wNew) / wTotal,
        bandProfile: blendedBands.map((v) => v / bNorm),
      };
      globalSp.totalDurationSec += localInfo.dur;
    }

    // Register unmatched voiced local speakers chronologically as new global speakers
    const localKeysInOrder = Array.from(byLocal.keys());
    for (const localKey of localKeysInOrder) {
      if (localToGlobal.has(localKey)) continue;
      const localInfo = localCentroids.get(localKey);
      if (localInfo || this.speakers.length === 0) {
        const label = `Speaker ${this.speakers.length + 1}`;
        localToGlobal.set(localKey, label);
        this.speakers.push({
          label,
          descriptor: localInfo?.desc || {
            segIdx: 0,
            medianF0Hz: 150,
            logF0: Math.log2(150),
            spectralCentroid: 900,
            bandProfile: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
            voicedRatio: 0.5,
          },
          totalDurationSec: localInfo?.dur || 1,
        });
      } else {
        localToGlobal.set(localKey, this.lastAssignedLabel);
      }
    }

    const mapped = chunkSegments.map((seg, i) => {
      const localKey = (seg.speaker || 'Speaker 1').trim() || 'Speaker 1';
      const resolvedSpeaker = localToGlobal.get(localKey) || this.lastAssignedLabel || 'Speaker 1';
      this.lastAssignedLabel = resolvedSpeaker;
      return {
        ...seg,
        id: `seg-ms-${idOffset + i + 1}`,
        start: Number((timeOffsetSec + seg.start).toFixed(2)),
        end: Number((timeOffsetSec + seg.end).toFixed(2)),
        speaker: resolvedSpeaker,
      };
    });

    return mapped;
  }
}

interface SttWorkerResponseMap {
  ready: { diarizationEnabled: boolean };
  chunkResult: { lines: MoonshineWasm.TranscriptLine[] };
  closed: Record<string, never>;
}

/**
 * Isolated Web Worker client for Moonshine WASM STT.
 * Keeps CPU inference completely off the main thread and frees 100% of WASM/ONNX
 * BFCArena memory via worker.terminate() during worker recycling and on completion.
 */
class MoonshineSttWorkerClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (data: unknown) => void;
      reject: (err: Error) => void;
      onProgress?: (prog: MoonshineDownloadProgress) => void;
    }
  >();
  private terminated = false;
  public diarizationEnabled = false;
  private abortState: {
    cancelled: boolean;
    worker?: Worker | null;
    abortClient?: (() => void) | null;
  };

  constructor(abortState: {
    cancelled: boolean;
    worker?: Worker | null;
    abortClient?: (() => void) | null;
  }) {
    this.abortState = abortState;
    this.worker = new Worker('/moonshine-stt-worker.js', { type: 'module' });
    abortState.worker = this.worker;
    abortState.abortClient = () => this.terminate();

    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg.type === 'progress') {
        const slot = this.pending.get(msg.id);
        slot?.onProgress?.({
          fraction: msg.total && msg.total > 0 ? Math.min(1, (msg.loaded || 0) / msg.total) : -1,
          loadedBytes: msg.loaded || 0,
          totalBytes: msg.total,
          file: msg.file || 'model',
        });
        return;
      }

      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);

      if (msg.type === 'error') {
        slot.reject(new Error(msg.message || 'STT Worker execution failed'));
      } else {
        slot.resolve(msg);
      }
    };

    this.worker.onerror = (event: ErrorEvent) => {
      const err = new Error(event.message || 'STT Web Worker crashed');
      for (const slot of this.pending.values()) {
        slot.reject(err);
      }
      this.pending.clear();
    };
  }

  private request<K extends keyof SttWorkerResponseMap>(
    payload: Record<string, unknown>,
    transfer?: Transferable[],
    onProgress?: (prog: MoonshineDownloadProgress) => void
  ): Promise<SttWorkerResponseMap[K]> {
    if (this.terminated) {
      return Promise.reject(new Error('STT worker already terminated.'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
        onProgress,
      });
      if (transfer && transfer.length > 0) {
        this.worker.postMessage({ ...payload, id }, transfer);
      } else {
        this.worker.postMessage({ ...payload, id });
      }
    });
  }

  public async init(params: {
    language: string;
    archKey: MoonshineArchKey;
    enableDiarization: boolean;
    onProgress?: (prog: MoonshineDownloadProgress) => void;
  }): Promise<void> {
    const res = await this.request<'ready'>(
      {
        type: 'init',
        language: params.language,
        archKey: params.archKey,
        enableDiarization: params.enableDiarization,
      },
      undefined,
      params.onProgress
    );
    this.diarizationEnabled = Boolean(res.diarizationEnabled);
  }

  public async transcribeChunk(
    chunkPcm: Float32Array,
    sampleRate = 16000
  ): Promise<MoonshineWasm.TranscriptLine[]> {
    // Copy only this single ~18s window (~1.1 MB) and transfer its ArrayBuffer zero-copy to the Worker
    const transferableCopy = chunkPcm.slice();
    const res = await this.request<'chunkResult'>(
      {
        type: 'transcribeChunk',
        audioBuffer: transferableCopy.buffer,
        sampleRate,
      },
      [transferableCopy.buffer]
    );
    return Array.isArray(res.lines) ? res.lines : [];
  }

  public terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    if (this.abortState.worker === this.worker) {
      this.abortState.worker = null;
    }
    this.abortState.abortClient = null;
    for (const slot of this.pending.values()) {
      slot.reject(new Error('STT worker terminated.'));
    }
    this.pending.clear();
    try {
      this.worker.terminate();
    } catch {}
  }
}

interface ChunkRunner {
  chunksSinceRecycle: number;
  diarizationEnabled: boolean;
  runChunk: (chunkPcm: Float32Array) => Promise<readonly MoonshineWasm.TranscriptLine[]>;
  recycle: () => Promise<void>;
  dispose: () => void;
}

async function createWorkerChunkRunner(params: {
  language: string;
  archKey: MoonshineArchKey;
  abortState: { cancelled: boolean; worker?: Worker | null; abortClient?: (() => void) | null };
  onProgress?: (prog: MoonshineDownloadProgress) => void;
}): Promise<ChunkRunner> {
  let diarizationFlag = true;
  let client = new MoonshineSttWorkerClient(params.abortState);
  let chunksSinceRecycle = 0;

  await client.init({
    language: params.language,
    archKey: params.archKey,
    enableDiarization: diarizationFlag,
    onProgress: params.onProgress,
  });
  diarizationFlag = client.diarizationEnabled;

  const recycleWorker = async (forceDisableDiarization = false) => {
    if (forceDisableDiarization) diarizationFlag = false;
    client.terminate();
    params.abortState.worker = null;
    await new Promise((r) => setTimeout(r, 35));
    if (params.abortState.cancelled) throw new MoonshineSttCancelledError();
    client = new MoonshineSttWorkerClient(params.abortState);
    chunksSinceRecycle = 0;
    await client.init({
      language: params.language,
      archKey: params.archKey,
      enableDiarization: diarizationFlag,
    });
    diarizationFlag = client.diarizationEnabled;
  };

  return {
    get chunksSinceRecycle() {
      return chunksSinceRecycle;
    },
    get diarizationEnabled() {
      return diarizationFlag;
    },
    runChunk: async (chunkPcm: Float32Array) => {
      if (params.abortState.cancelled) throw new MoonshineSttCancelledError();
      try {
        const lines = await client.transcribeChunk(chunkPcm, 16000);
        chunksSinceRecycle += 1;
        return lines;
      } catch (err) {
        if (params.abortState.cancelled) throw new MoonshineSttCancelledError();
        // If native WASM diarization pushed memory over limit, drop native diarization
        // and lean on our lightweight acoustic PCM speaker detector
        if (diarizationFlag) {
          console.warn(
            '[Moonshine STT] Worker retry without native diarization to preserve memory:',
            err
          );
          await recycleWorker(true);
          const lines = await client.transcribeChunk(chunkPcm, 16000);
          chunksSinceRecycle += 1;
          return lines;
        }
        throw err;
      }
    },
    recycle: () => recycleWorker(false),
    dispose: () => {
      client.terminate();
      params.abortState.worker = null;
    },
  };
}

async function transcribeChunkWithSubdivisionFallback(params: {
  runner: ChunkRunner;
  pcm16k: Float32Array;
  startSample: number;
  endSample: number;
  registry: CrossChunkSpeakerRegistry;
  idCounter: { next: number };
  abortState: { cancelled: boolean };
}): Promise<TranscriptSegment[]> {
  if (params.abortState.cancelled) {
    throw new MoonshineSttCancelledError();
  }

  const sampleRate = 16000;
  const sliceLen = params.endSample - params.startSample;
  if (sliceLen < 1600) return [];

  const chunkSlice = params.pcm16k.subarray(params.startSample, params.endSample);
  const chunkOffsetSec = params.startSample / sampleRate;
  const chunkDurationSec = sliceLen / sampleRate;

  try {
    const lines = await params.runner.runChunk(chunkSlice);
    const rawSegments = mapMoonshineLinesToSegments(lines, chunkDurationSec, chunkSlice);
    const aligned = params.registry.mapChunkSegments(
      rawSegments,
      chunkSlice,
      chunkOffsetSec,
      params.idCounter.next
    );
    params.idCounter.next += aligned.length;
    return aligned;
  } catch (chunkErr) {
    if (params.abortState.cancelled || chunkErr instanceof MoonshineSttCancelledError) {
      throw new MoonshineSttCancelledError();
    }
    // Subdivide an oversized/problematic chunk into halves (>= 9s threshold) before giving up
    if (chunkDurationSec >= 9) {
      console.warn(
        `[Moonshine STT] Subdividing ${chunkDurationSec.toFixed(1)}s chunk after error:`,
        chunkErr
      );
      const midSample = params.startSample + Math.floor(sliceLen / 2);
      await new Promise((r) => setTimeout(r, 25));
      const firstHalf = await transcribeChunkWithSubdivisionFallback({
        ...params,
        endSample: midSample,
      });
      await new Promise((r) => setTimeout(r, 25));
      const secondHalf = await transcribeChunkWithSubdivisionFallback({
        ...params,
        startSample: midSample,
      });
      return [...firstHalf, ...secondHalf];
    }
    throw chunkErr;
  }
}

export async function transcribeAudioFileWithMoonshine(params: {
  fileOrBlob: Blob;
  language: string;
  arch?: MoonshineArchKey;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
  onStage?: (stage: string) => void;
  onChunkProgress?: (progress: MoonshineTranscriptionProgress) => void;
  onPartialSegments?: (segmentsSoFar: TranscriptSegment[]) => void;
}): Promise<MoonshineTranscriptionResult> {
  // Abort any superseded run and free ALL cached main-thread WASM graphs before decoding/worker start
  abortActiveSttSession();
  releaseCachedTts();
  releaseCachedTranscriber();

  const abortState: {
    cancelled: boolean;
    worker?: Worker | null;
    abortClient?: (() => void) | null;
  } = { cancelled: false, worker: null, abortClient: null };
  activeSttAbortController = abortState;

  params.onStage?.('Decoding & resampling audio to 16 kHz mono...');
  const { pcm16k, durationSeconds } = await decodeBlobTo16kMonoPcm(params.fileOrBlob);
  if (abortState.cancelled) throw new MoonshineSttCancelledError();

  // Yield briefly so temporary decoding buffers are garbage-collected before WASM allocation
  await new Promise((resolve) => setTimeout(resolve, 25));
  if (abortState.cancelled) throw new MoonshineSttCancelledError();

  const opt = getLanguageOption(params.language);
  if (!opt || !opt.sttSupported) {
    throw new Error(
      `Local speech-to-text pack for "${opt?.label || params.language}" is not bundled in this Moonshine WASM release yet. Please choose English, Spanish, Japanese, Arabic, Mandarin, Vietnamese, Korean, or Ukrainian.`
    );
  }

  const archDecision = selectMemorySafeSttArch(params.arch, durationSeconds, opt.code);
  const requestedArch = resolveArchForLanguage(opt.code, params.arch);
  const arch = archDecision.arch;

  params.onStage?.(
    archDecision.notice ||
      'Loading isolated Moonshine WebAssembly speech & speaker diarization worker...'
  );

  let runner: ChunkRunner | null = null;
  const canUseWorker =
    typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof URL !== 'undefined';

  if (canUseWorker) {
    try {
      runner = await createWorkerChunkRunner({
        language: opt.code,
        archKey: arch,
        abortState,
        onProgress: params.onProgress,
      });
    } catch (workerInitErr) {
      if (abortState.cancelled) throw new MoonshineSttCancelledError();
      console.warn(
        '[Moonshine STT] Dedicated STT worker unavailable, falling back to main-thread chunking:',
        workerInitErr
      );
      runner = null;
    }
  }

  if (!runner) {
    const loaded = await getOrLoadTranscriber({
      language: opt.code,
      arch,
      enableDiarization: true,
      onProgress: params.onProgress,
    });
    let mainThreadChunks = 0;
    runner = {
      get chunksSinceRecycle() {
        return mainThreadChunks;
      },
      get diarizationEnabled() {
        return loaded.diarizationEnabled;
      },
      runChunk: async (chunkPcm) => {
        const res = loaded.transcriber.transcribe(chunkPcm, { sampleRate: 16000 });
        mainThreadChunks += 1;
        return res.lines;
      },
      recycle: async () => {
        mainThreadChunks = 0;
      },
      dispose: () => {
        releaseCachedTranscriber();
      },
    };
  }

  const activeRunner: ChunkRunner = runner;
  const MAX_CHUNKS_PER_WORKER = 14;
  const chunks = planAudioTranscriptionChunks(pcm16k);
  const registry = new CrossChunkSpeakerRegistry();
  const idCounter = { next: 0 };
  const allSegments: TranscriptSegment[] = [];
  let lastProcessedSeconds = 0;

  try {
    for (let i = 0; i < chunks.length; i++) {
      if (abortState.cancelled) {
        throw new MoonshineSttCancelledError();
      }

      // Periodically recycle the Worker so ONNX Runtime BFCArena & WASM heap return to 0 MB
      if (activeRunner.chunksSinceRecycle >= MAX_CHUNKS_PER_WORKER && i < chunks.length) {
        params.onStage?.(`Refreshing isolated speech worker memory (${i}/${chunks.length})...`);
        await activeRunner.recycle();
      }

      const win = chunks[i];
      params.onStage?.(
        chunks.length > 1
          ? `Transcribing segment ${i + 1} of ${chunks.length} (${Math.round((win.startTime / Math.max(1, durationSeconds)) * 100)}%)...`
          : `Transcribing & identifying speakers locally (${arch.replace('_', ' ')})...`
      );

      params.onChunkProgress?.({
        currentChunk: i + 1,
        totalChunks: chunks.length,
        processedSeconds: win.startTime,
        totalSeconds: durationSeconds,
        fraction: i / Math.max(1, chunks.length),
        activeArch: arch,
        autoSwitchedFrom: archDecision.autoSwitchedFrom,
        autoSwitchNotice: archDecision.notice,
      });

      await new Promise((resolve) => setTimeout(resolve, 15));

      const chunkSegments = await transcribeChunkWithSubdivisionFallback({
        runner: activeRunner,
        pcm16k,
        startSample: win.startSample,
        endSample: win.endSample,
        registry,
        idCounter,
        abortState,
      });

      for (const seg of chunkSegments) {
        const prev = allSegments[allSegments.length - 1];
        const clampedStart = prev ? Math.max(prev.start, seg.start) : seg.start;
        const clampedEnd = Math.max(clampedStart + 0.35, Math.min(durationSeconds, seg.end));
        allSegments.push({
          ...seg,
          start: Number(clampedStart.toFixed(2)),
          end: Number(clampedEnd.toFixed(2)),
        });
      }

      lastProcessedSeconds = Math.min(durationSeconds, win.endTime);
      params.onPartialSegments?.([...allSegments]);

      params.onChunkProgress?.({
        currentChunk: i + 1,
        totalChunks: chunks.length,
        processedSeconds: Math.min(durationSeconds, win.endTime),
        totalSeconds: durationSeconds,
        fraction: (i + 1) / Math.max(1, chunks.length),
        activeArch: arch,
        autoSwitchedFrom: archDecision.autoSwitchedFrom,
        autoSwitchNotice: archDecision.notice,
      });
    }
  } catch (loopErr) {
    if (abortState.cancelled || loopErr instanceof MoonshineSttCancelledError) {
      const completedSegments = allSegments.filter(
        (s) => s.text && s.text.trim().length > 0
      );
      if (completedSegments.length > 0) {
        const partialTranscript = completedSegments.map((s) => s.text).join(' ').trim();
        const langLabel = opt.label || opt.code.toUpperCase();
        const speakers = Array.from(
          new Set(completedSegments.map((s) => s.speaker || 'Speaker 1'))
        );
        const lastSegEnd = completedSegments[completedSegments.length - 1]?.end || 0;
        const processedSec = Math.max(1, lastProcessedSeconds || lastSegEnd);
        const partialSummary = buildLocalSummary(
          partialTranscript,
          processedSec,
          langLabel,
          durationSeconds
        );
        throw new MoonshineSttCancelledError({
          language: opt.code,
          modelArch: arch,
          requestedModelArch: requestedArch,
          autoSwitchedModel: Boolean(archDecision.autoSwitchedFrom),
          segments: completedSegments,
          fullTranscript: partialTranscript,
          summary: partialSummary,
          durationSeconds,
          speakerCount: speakers.length,
          speakers,
        });
      }
      throw new MoonshineSttCancelledError();
    }
    throw loopErr;
  } finally {
    // Always terminate STT worker / release model memory immediately after transcription completes or aborts
    activeRunner.dispose();
    if (activeSttAbortController === abortState) {
      activeSttAbortController = null;
    }
  }

  const fullTranscript = allSegments.map((s) => s.text).join(' ').trim();
  const langLabel = opt.label || opt.code.toUpperCase();
  const speakers = Array.from(new Set(allSegments.map((s) => s.speaker || 'Speaker 1')));

  return {
    language: opt.code,
    modelArch: arch,
    requestedModelArch: requestedArch,
    autoSwitchedModel: Boolean(archDecision.autoSwitchedFrom),
    segments:
      allSegments.length > 0
        ? allSegments
        : [
            {
              id: `seg-ms-${Date.now()}-1`,
              start: 0,
              end: Number(Math.max(1, durationSeconds).toFixed(2)),
              speaker: 'Speaker 1',
              text: '(No spoken words detected in audio)',
            },
          ],
    fullTranscript,
    summary: buildLocalSummary(fullTranscript, durationSeconds, langLabel),
    durationSeconds,
    speakerCount: speakers.length,
    speakers,
  };
}

export interface LiveMicCaptureSession {
  stop: () => Promise<{
    audioBlob: Blob;
    durationSeconds: number;
    segments: TranscriptSegment[];
    fullTranscript: string;
    summary: string;
    language: string;
    modelArch: MoonshineArchKey;
    speakerCount: number;
    speakers: string[];
  }>;
  abort: () => void;
}

export async function startMoonshineLiveMicSession(params: {
  language: string;
  arch?: MoonshineArchKey;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
  onStage?: (stage: string) => void;
  onPartialText?: (text: string) => void;
  onLineCommitted?: (line: { id: string; text: string; startTime: number; duration: number }) => void;
  onError?: (err: Error) => void;
}): Promise<LiveMicCaptureSession> {
  params.onStage?.('Preparing Moonshine WebAssembly model & speaker diarization...');
  const { transcriber, language, arch } = await getOrLoadTranscriber({
    language: params.language,
    arch: params.arch,
    enableDiarization: true,
    onProgress: params.onProgress,
  });

  params.onStage?.('Requesting microphone access...');
  const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const inputSampleRate = audioContext.sampleRate;
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);
  const stream = transcriber.createStream({ updateInterval: 0.45 });

  const recorded16kChunks: Float32Array[] = [];
  const lineMap = new Map<string, MoonshineWasm.TranscriptLine>();

  stream.addListener({
    onLineTextChanged: (event) => {
      lineMap.set(event.line.id, event.line);
      params.onPartialText?.(event.line.text);
    },
    onLineCompleted: (event) => {
      lineMap.set(event.line.id, event.line);
      params.onPartialText?.('');
      params.onLineCommitted?.({
        id: event.line.id,
        text: event.line.text,
        startTime: event.line.startTime,
        duration: event.line.duration,
      });
    },
    onError: (event) => {
      const err = event.error instanceof Error ? event.error : new Error(String(event.error));
      params.onError?.(err);
    },
  });

  stream.start();

  const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  let active = true;

  processorNode.onaudioprocess = (event) => {
    if (!active) return;
    const monoInput = event.inputBuffer.getChannelData(0);
    const pcm16k = resampleFloat32To16k(monoInput, inputSampleRate);
    recorded16kChunks.push(pcm16k);
    try {
      stream.addAudio(pcm16k, 16000);
      stream.transcribe();
    } catch (err) {
      params.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);

  const cleanupMedia = async () => {
    active = false;
    try {
      processorNode.disconnect();
    } catch {}
    try {
      sourceNode.disconnect();
    } catch {}
    mediaStream.getTracks().forEach((t) => t.stop());
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => {});
    }
  };

  return {
    stop: async () => {
      await cleanupMedia();
      try {
        stream.stop();
      } catch {}

      let totalSamples = 0;
      for (const c of recorded16kChunks) totalSamples += c.length;
      const merged16k = new Float32Array(totalSamples);
      let offset = 0;
      for (const c of recorded16kChunks) {
        merged16k.set(c, offset);
        offset += c.length;
      }

      const durationSeconds = Math.max(1, Number((totalSamples / 16000).toFixed(2)));
      const audioBlob = float32PcmToWavBlob(merged16k, 16000);

      let orderedLines = [...lineMap.values()].sort((a, b) => a.startTime - b.startTime);
      if (orderedLines.every((l) => !l.text.trim()) && totalSamples > 3200) {
        try {
          const fallbackTranscript = transcriber.transcribe(merged16k, { sampleRate: 16000 });
          orderedLines = [...fallbackTranscript.lines];
        } catch {}
      }

      try {
        stream.close();
      } catch {}

      const segments = mapMoonshineLinesToSegments(orderedLines, durationSeconds, merged16k);
      const fullTranscript = segments.map((s) => s.text).join(' ').trim();
      const langLabel = getLanguageOption(language)?.label || language.toUpperCase();
      const speakers = Array.from(new Set(segments.map((s) => s.speaker || 'Speaker 1')));

      return {
        audioBlob,
        durationSeconds,
        segments:
          segments.length > 0
            ? segments
            : [
                {
                  id: `seg-ms-${Date.now()}-1`,
                  start: 0,
                  end: durationSeconds,
                  speaker: 'Speaker 1',
                  text: '(No spoken words detected in recording)',
                },
              ],
        fullTranscript,
        summary: buildLocalSummary(fullTranscript, durationSeconds, langLabel),
        language,
        modelArch: arch,
        speakerCount: speakers.length,
        speakers,
      };
    },
    abort: () => {
      void cleanupMedia();
      try {
        stream.stop();
        stream.close();
      } catch {}
    },
  };
}

// ============================================================================
// NATURAL PHRASING, ROOM-BREATH TRANSITIONS, ZIPVOICE PREP & WSOLA TIMING
// ============================================================================

const TONE_PACING_PROFILES: Record<
  VoiceTone,
  { speedBias: number; pauseScale: number; maxNaturalWpm: number }
> = {
  natural: { speedBias: 0.94, pauseScale: 1.0, maxNaturalWpm: 158 },
  storytelling: { speedBias: 0.89, pauseScale: 1.28, maxNaturalWpm: 146 },
  broadcast: { speedBias: 0.97, pauseScale: 0.85, maxNaturalWpm: 168 },
  energetic: { speedBias: 1.04, pauseScale: 0.72, maxNaturalWpm: 178 },
};

function concatPcmChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Normalizes and cleans subtitle/script text into safe, G2P-friendly spoken text
 * so Kokoro, Piper, and ZipVoice WASM engines never receive empty phonemes or control symbols.
 */
export function sanitizeTtsSpeakableText(raw: string): string {
  let text = sanitizeSubtitleCueText(raw || '');
  if (!text) return '';

  text = text
    // Strip emojis, variation selectors, ZWJ, symbol dingbats
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE00-\uFE0F\u200D]/gu, ' ')
    // Convert smart typography quotes & dashes
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[—–]/g, ', ')
    // Simplify raw URLs to domain name so G2P stays clean
    .replace(/https?:\/\/(?:www\.)?([^/\s]+)\S*/gi, '$1')
    // Strip stray markdown/code symbols
    .replace(/[*_`~#|\\<>^=]+/g, ' ')
    // Collapse repeated punctuation
    .replace(/…|\.{2,}/g, '.')
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/,{2,}/g, ',')
    // Remove stray space before punctuation introduced by stripped formatting tokens
    .replace(/\s+([.,!?;:])/g, '$1')
    // Remove leading orphan punctuation
    .replace(/^[\s,;:.!?'"-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[\p{L}\p{N}]/u.test(text)) {
    return '';
  }

  return text;
}

/**
 * Splits any single phrase longer than `maxChars` at comma/word boundaries
 * so Kokoro's 512-phoneme cap and ZipVoice's text encoder buffers never overflow.
 */
export function splitOversizedTtsText(text: string, maxChars: number = 190): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const words = clean.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        parts.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        parts.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) parts.push(current);
      current = word;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Splits a script into natural spoken phrases respecting paragraph pauses,
 * sentence boundaries, breathing pauses inside long clauses, and WASM max length caps.
 */
export function splitIntoNaturalPhrases(text: string): NaturalPhraseChunk[] {
  const normalized = (text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: NaturalPhraseChunk[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const isLastParagraph = pIdx === paragraphs.length - 1;
    const lines = paragraphs[pIdx]
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const isLastLine = lIdx === lines.length - 1;
      const sentences = lines[lIdx]
        .split(/(?<=[.!?।。؟…])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const sentence = sanitizeTtsSpeakableText(sentences[sIdx]);
        if (!sentence) continue;
        const isLastSentence = sIdx === sentences.length - 1;
        const words = sentence.split(/\s+/).filter(Boolean);

        // If a sentence is long (> 11 words or > 180 chars), break cleanly at clause/word boundaries
        if (words.length > 11 || sentence.length > 180) {
          const subClauses = sentence
            .split(/(?<=[,;:])\s+/)
            .map((c) => sanitizeTtsSpeakableText(c))
            .filter(Boolean);

          const mergedClauses: string[] = [];
          let buffer = '';
          for (const clause of subClauses) {
            const candidate = buffer ? `${buffer} ${clause}` : clause;
            const candidateWords = candidate.split(/\s+/).filter(Boolean).length;
            if (!buffer || (candidateWords <= 7 && candidate.length <= 165)) {
              buffer = candidate;
            } else {
              mergedClauses.push(...splitOversizedTtsText(buffer, 185));
              buffer = clause;
            }
          }
          if (buffer) {
            mergedClauses.push(...splitOversizedTtsText(buffer, 185));
          }

          for (let cIdx = 0; cIdx < mergedClauses.length; cIdx++) {
            const safePiece = sanitizeTtsSpeakableText(mergedClauses[cIdx]);
            if (!safePiece) continue;
            const isLastClause = cIdx === mergedClauses.length - 1;
            const breakAfter: NaturalPhraseChunk['breakAfter'] = !isLastClause
              ? 'clause'
              : !isLastSentence || !isLastLine
              ? 'sentence'
              : !isLastParagraph
              ? 'paragraph'
              : 'none';
            chunks.push({ text: safePiece, breakAfter });
          }
        } else {
          const breakAfter: NaturalPhraseChunk['breakAfter'] =
            !isLastSentence || !isLastLine
              ? 'sentence'
              : !isLastParagraph
              ? 'paragraph'
              : 'none';
          chunks.push({ text: sentence, breakAfter });
        }
      }
    }
  }

  return chunks;
}

/**
 * Cleans and normalizes a ZipVoice cloning reference clip (minimum ~1.8s up to 8.5s active voiced speech,
 * finite-safe, DC rumble removal, silence trim, RMS normalization to -17 dBFS) so Male & Female
 * fundamental pitch and vocal formants come through vividly without WASM extraction failures.
 */
export function prepareCloneReferencePcm(raw16k: Float32Array): Float32Array {
  if (raw16k.length < 1600) {
    const out = new Float32Array(raw16k.length);
    for (let i = 0; i < raw16k.length; i++) {
      out[i] = Number.isFinite(raw16k[i]) ? raw16k[i] : 0;
    }
    return out;
  }

  // 1. Sanitize non-finite values & apply gentle 1st-order high-pass (~65Hz @ 16kHz)
  const filtered = new Float32Array(raw16k.length);
  const alpha = 0.975;
  let prevX = Number.isFinite(raw16k[0]) ? raw16k[0] : 0;
  let prevY = 0;
  for (let i = 0; i < raw16k.length; i++) {
    const x = Number.isFinite(raw16k[i]) ? raw16k[i] : 0;
    const y = alpha * (prevY + x - prevX);
    filtered[i] = y;
    prevX = x;
    prevY = y;
  }

  // 2. Compute 20ms frame RMS profile to find cleanest active speech boundaries
  const win = 320;
  const numFrames = Math.floor(filtered.length / win);
  if (numFrames < 4) return filtered;

  const rmsList = new Float32Array(numFrames);
  let maxRms = 0;
  for (let f = 0; f < numFrames; f++) {
    let sq = 0;
    const base = f * win;
    for (let j = 0; j < win; j++) sq += filtered[base + j] * filtered[base + j];
    const rms = Math.sqrt(sq / win);
    rmsList[f] = rms;
    if (rms > maxRms) maxRms = rms;
  }

  const gate = Math.max(0.005, maxRms * 0.08);
  let firstActive = 0;
  let lastActive = numFrames - 1;
  while (firstActive < numFrames && rmsList[firstActive] < gate) firstActive++;
  while (lastActive > firstActive && rmsList[lastActive] < gate) lastActive--;

  const padFrames = 4; // 80ms pad
  let sliceStart = Math.max(0, (firstActive - padFrames) * win);
  let sliceEnd = Math.min(filtered.length, (lastActive + padFrames + 1) * win);

  // Ensure at least ~1.8s (28800 samples) when available so ZipVoice clone_asr / extractSpeechClip never rejects short clips
  const minSafeSamples = Math.min(filtered.length, 28800);
  if (sliceEnd - sliceStart < minSafeSamples) {
    const center = Math.floor((sliceStart + sliceEnd) / 2);
    sliceStart = Math.max(0, center - Math.floor(minSafeSamples / 2));
    sliceEnd = Math.min(filtered.length, sliceStart + minSafeSamples);
    if (sliceEnd - sliceStart < minSafeSamples) {
      sliceStart = Math.max(0, sliceEnd - minSafeSamples);
    }
  }

  // If longer than 8.5s, pick best continuous 7.0s active speech window
  const maxTargetSamples = Math.floor(8.5 * 16000);
  const windowSamples = Math.floor(7.0 * 16000);

  if (sliceEnd - sliceStart > maxTargetSamples) {
    let bestScore = -1;
    let bestStart = sliceStart;
    const stepSamples = 16000; // 1s step
    for (let pos = sliceStart; pos + windowSamples <= sliceEnd; pos += stepSamples) {
      const fStart = Math.floor(pos / win);
      const fEnd = Math.min(numFrames, Math.floor((pos + windowSamples) / win));
      let activeCount = 0;
      let energySum = 0;
      for (let f = fStart; f < fEnd; f++) {
        if (rmsList[f] >= gate) {
          activeCount += 1;
          energySum += rmsList[f];
        }
      }
      const score = activeCount * 0.6 + energySum * 4.0;
      if (score > bestScore) {
        bestScore = score;
        bestStart = pos;
      }
    }
    sliceStart = bestStart;
    sliceEnd = Math.min(filtered.length, bestStart + windowSamples);
  }

  const clipped = filtered.slice(sliceStart, sliceEnd);
  if (clipped.length === 0) return filtered;

  // 3. Soft fade edges (15ms) and RMS normalize voiced region to 0.135 (~-17.4 dBFS)
  let activeSq = 0;
  let activeCount = 0;
  for (let i = 0; i < clipped.length; i++) {
    if (Math.abs(clipped[i]) > gate * 0.5) {
      activeSq += clipped[i] * clipped[i];
      activeCount += 1;
    }
  }
  const activeRms = Math.sqrt(activeSq / Math.max(1, activeCount));
  const gain = activeRms > 1e-4 ? Math.min(8.0, 0.135 / activeRms) : 1.0;

  const out = new Float32Array(clipped.length);
  const fadeSamples = Math.min(240, Math.floor(clipped.length / 8));
  for (let i = 0; i < clipped.length; i++) {
    let sample = clipped[i] * gain;
    if (Math.abs(sample) > 0.88) {
      sample = 0.88 * Math.tanh(sample / 0.88);
    }
    if (i < fadeSamples) {
      sample *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeSamples);
    } else if (i >= clipped.length - fadeSamples) {
      const rem = clipped.length - 1 - i;
      sample *= 0.5 - 0.5 * Math.cos((Math.PI * rem) / fadeSamples);
    }
    out[i] = sample;
  }

  return out;
}

/**
 * Pitch-preserving WSOLA (Waveform Similarity Overlap-Add) time-scale modification.
 * Changes speech cadence cleanly without altering Male or Female vocal pitch/formants.
 */
export function timeScaleWsolaPcm(
  input: Float32Array,
  sampleRate: number,
  speedMultiplier: number
): Float32Array {
  const safeSpeed = Math.max(0.65, Math.min(1.6, speedMultiplier));
  if (Math.abs(safeSpeed - 1.0) < 0.03 || input.length < Math.floor(sampleRate * 0.12)) {
    return input;
  }

  const winSize = Math.max(256, Math.round(sampleRate * 0.028)); // 28ms window
  const synthesisHop = Math.floor(winSize / 2); // 50% Hann overlap
  const analysisHop = Math.max(16, Math.round(synthesisHop * safeSpeed));
  const tolerance = Math.floor(sampleRate * 0.010); // +/- 10ms phase alignment search

  const hann = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
  }

  const estOutLen = Math.max(winSize, Math.round(input.length / safeSpeed));
  const output = new Float32Array(estOutLen + winSize);
  const norm = new Float32Array(estOutLen + winSize);

  // Copy initial frame
  for (let i = 0; i < winSize && i < input.length; i++) {
    output[i] += input[i] * hann[i];
    norm[i] += hann[i];
  }

  let nominalInPos = analysisHop;
  let actualPrevEnd = synthesisHop;
  let outPos = synthesisHop;

  while (nominalInPos + winSize < input.length && outPos < estOutLen) {
    const searchStart = Math.max(0, nominalInPos - tolerance);
    const searchEnd = Math.min(input.length - winSize, nominalInPos + tolerance);

    // Phase-align against natural continuation of previous input grain
    let bestInPos = nominalInPos;
    let bestScore = -Infinity;
    const step = 2; // 2-sample search step for crisp speed & accuracy

    for (let cand = searchStart; cand <= searchEnd; cand += step) {
      let dot = 0;
      let magA = 0;
      let magB = 0;
      const compareLen = synthesisHop;
      if (actualPrevEnd + compareLen < input.length) {
        for (let k = 0; k < compareLen; k += 2) {
          const ref = input[actualPrevEnd + k];
          const cur = input[cand + k];
          dot += ref * cur;
          magA += ref * ref;
          magB += cur * cur;
        }
        const score = dot / (Math.sqrt(magA * magB) + 1e-9);
        if (score > bestScore) {
          bestScore = score;
          bestInPos = cand;
        }
      }
    }

    for (let i = 0; i < winSize; i++) {
      output[outPos + i] += input[bestInPos + i] * hann[i];
      norm[outPos + i] += hann[i];
    }

    actualPrevEnd = bestInPos + synthesisHop;
    nominalInPos += analysisHop;
    outPos += synthesisHop;
  }

  const finalLen = Math.min(estOutLen, outPos + synthesisHop);
  const result = new Float32Array(finalLen);
  for (let i = 0; i < finalLen; i++) {
    result[i] = norm[i] > 1e-4 ? Math.max(-0.98, Math.min(0.98, output[i] / norm[i])) : 0;
  }
  return result;
}

function trimTtsChunkEdges(pcm: Float32Array, sampleRate: number): Float32Array {
  if (pcm.length === 0) return pcm;
  const threshold = 0.004;
  let start = 0;
  let end = pcm.length - 1;
  while (start < end && Math.abs(pcm[start]) < threshold) start++;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;

  const pad = Math.floor(sampleRate * 0.025); // Keep subtle 25ms natural onset/decay pad
  start = Math.max(0, start - pad);
  end = Math.min(pcm.length, end + pad + 1);
  const trimmed = pcm.slice(start, end);

  const fadeIn = Math.min(Math.floor(sampleRate * 0.014), Math.floor(trimmed.length / 4));
  const fadeOut = Math.min(Math.floor(sampleRate * 0.024), Math.floor(trimmed.length / 4));
  for (let i = 0; i < fadeIn; i++) {
    trimmed[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeIn);
  }
  for (let i = 0; i < fadeOut; i++) {
    const idx = trimmed.length - 1 - i;
    trimmed[idx] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeOut);
  }
  return trimmed;
}

/**
 * Generates an organic pause gap containing subtle -56dB studio room comfort tone
 * and, on sentence/speaker transitions when naturalBreaths=true, a gentle realistic inhale breath.
 */
export function createNaturalPauseGapPcm(
  durationSeconds: number,
  sampleRate: number,
  options?: { addBreath?: boolean; seedOffset?: number }
): Float32Array {
  const numSamples = Math.max(0, Math.round(durationSeconds * sampleRate));
  if (numSamples === 0) return new Float32Array(0);
  const out = new Float32Array(numSamples);

  // Deterministic lightweight noise generator for subtle studio room floor (-58 dB)
  let state = (options?.seedOffset ?? 1337) + numSamples * 17;
  const nextRand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff - 0.5;
  };

  let lp = 0;
  for (let i = 0; i < numSamples; i++) {
    lp = lp * 0.72 + nextRand() * 0.28;
    out[i] = lp * 0.0014;
  }

  // Organic breath envelope placed ~100ms before speech resumes
  if (options?.addBreath && durationSeconds >= 0.30) {
    const breathSamples = Math.min(Math.floor(numSamples * 0.65), Math.round(sampleRate * 0.165));
    const tailOffset = Math.min(Math.floor(numSamples * 0.15), Math.round(sampleRate * 0.06));
    const breathStart = Math.max(0, numSamples - tailOffset - breathSamples);

    let bLp = 0;
    let bPrev = 0;
    for (let i = 0; i < breathSamples; i++) {
      const raw = nextRand();
      // Gentle bandpass feel (400Hz..2200Hz air texture)
      bLp = bLp * 0.58 + raw * 0.42;
      const bp = bLp - bPrev * 0.45;
      bPrev = bLp;
      // Smooth bell envelope peaking cleanly mid-inhale at ~-39 dB
      const phase = i / Math.max(1, breathSamples - 1);
      const env = Math.sin(Math.PI * phase) ** 1.6;
      out[breathStart + i] += bp * env * 0.015;
    }
  }

  return out;
}

function getPauseDurationForBreak(
  breakAfter: NaturalPhraseChunk['breakAfter'],
  pauseScale: number,
  speed: number
): number {
  const speedComp = 1 / Math.max(0.75, Math.min(1.25, speed));
  switch (breakAfter) {
    case 'clause':
      return 0.20 * pauseScale * speedComp;
    case 'sentence':
      return 0.44 * pauseScale * speedComp;
    case 'paragraph':
      return 0.72 * pauseScale * speedComp;
    default:
      return 0;
  }
}

function postProcessSynthesizedPhrasePcm(params: {
  rawAudio: Float32Array;
  sampleRate: number;
  phraseText: string;
  targetSpeed: number;
  maxNaturalWpm: number;
  usedCloning: boolean;
}): Float32Array {
  const cleaned = trimTtsChunkEdges(params.rawAudio, params.sampleRate);
  if (cleaned.length < 400) return cleaned;

  const actualDur = cleaned.length / params.sampleRate;
  const wordCount = params.phraseText.trim().split(/\s+/).filter(Boolean).length;

  let wsolaMultiplier = 1.0;

  if (params.usedCloning) {
    // ZipVoice flow-matching clones may rush through clauses or under-apply speed slider:
    // enforce pitch-preserving WSOLA tempo correction when requested or when delivery exceeds natural WPM.
    const measuredWpm = actualDur > 0.35 && wordCount >= 3 ? (wordCount / actualDur) * 60 : 0;
    const ceilingWpm = params.maxNaturalWpm * params.targetSpeed;

    if (measuredWpm > ceilingWpm * 1.06) {
      wsolaMultiplier = Math.max(0.76, Math.min(0.98, ceilingWpm / measuredWpm));
    } else if (Math.abs(params.targetSpeed - 1.0) >= 0.06) {
      wsolaMultiplier = params.targetSpeed;
    }
  } else if (params.targetSpeed < 0.94) {
    // Gentle clarity tempo polish below default speed if Kokoro stays brisk
    const measuredWpm = actualDur > 0.45 && wordCount >= 4 ? (wordCount / actualDur) * 60 : 0;
    if (measuredWpm > params.maxNaturalWpm * params.targetSpeed * 1.12) {
      wsolaMultiplier = Math.max(0.84, (params.maxNaturalWpm * params.targetSpeed) / measuredWpm);
    }
  }

  return Math.abs(wsolaMultiplier - 1.0) >= 0.03
    ? timeScaleWsolaPcm(cleaned, params.sampleRate, wsolaMultiplier)
    : cleaned;
}

/**
 * Pure PCM composer used by both single-script synthesis and testing to verify
 * pause durations, breath insertion, and edge fading without requiring WASM weights.
 */
export function composeNaturalPcmSequence(
  items: Array<{ pcm: Float32Array; pauseAfterSec: number; addBreath?: boolean }>,
  sampleRate: number
): Float32Array {
  const parts: Float32Array[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.pcm.length > 0) parts.push(item.pcm);
    if (item.pauseAfterSec > 0.01 && i < items.length - 1) {
      parts.push(
        createNaturalPauseGapPcm(item.pauseAfterSec, sampleRate, {
          addBreath: Boolean(item.addBreath),
          seedOffset: 2026 + i * 97,
        })
      );
    }
  }
  return concatPcmChunks(parts);
}

function formatMoonshineTtsError(err: unknown, context: string): Error {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const trimmed = rawMsg.trim();
  const isGenericUnknown =
    !trimmed ||
    /^unknown error$/i.test(trimmed) ||
    /^moonshine:-1:unknown error$/i.test(trimmed) ||
    /^unknown moonshine error$/i.test(trimmed);

  if (isGenericUnknown) {
    return new Error(
      `Local Moonshine neural speech engine encountered a recoverable memory or tokenization limit while ${context}. Try short clean sentences or close/reopen the tab if browser WASM memory is full.`
    );
  }
  return new Error(trimmed);
}

function canUseZipVoiceCloningForLanguage(
  mod: MoonshineWasm.MoonshineModule,
  moonshineLanguage: string
): boolean {
  const base = moonshineLanguage.toLowerCase();
  if (base === 'en' || base === 'en_us' || base === 'en_gb' || base === 'zh') {
    return true;
  }
  try {
    if (mod.ttsDependencies) {
      const deps = JSON.parse(mod.ttsDependencies(moonshineLanguage, 'zipvoice_american_female'));
      const groups: Array<{ role?: string; files?: Array<{ name?: string }> }> = deps?.groups || [];
      const hasAsr = groups.some((g) => g.role === 'clone_asr');
      const files = groups.flatMap((g) => (g.files || []).map((f) => f.name || ''));
      const hasG2p = files.some((n) => n.includes('dict') || n.includes('g2p'));
      return hasAsr && hasG2p;
    }
  } catch {}
  return false;
}

async function synthesizePhraseViaWorkerOrMain(
  tts: MoonshineWasm.TextToSpeech,
  text: string
): Promise<{ audio: Float32Array; sampleRate: number }> {
  const host = (tts as unknown as {
    workerHost?: {
      closed?: boolean;
      synthesize?: (t: string) => Promise<{ audio: Float32Array; sampleRate: number }>;
    };
  }).workerHost;

  if (host && !host.closed && typeof host.synthesize === 'function') {
    return host.synthesize(text);
  }
  return tts.synthesize(text);
}

async function buildAndLoadTtsInstance(params: {
  ns: MoonshineModuleNs;
  mod: MoonshineWasm.MoonshineModule;
  moonshineLanguage: string;
  voiceId: string;
  effectiveSpeed: number;
  useCloning: boolean;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
}): Promise<MoonshineWasm.TextToSpeech> {
  const builder = new params.ns.TextToSpeech()
    .useModule(params.mod)
    .language(params.moonshineLanguage)
    .nativeOptions({ speed: params.effectiveSpeed.toFixed(2) })
    .onProgress((fraction, file, bytes) => {
      params.onProgress?.({
        fraction: bytes?.total ? Math.min(1, fraction) : -1,
        loadedBytes: bytes?.loaded ?? 0,
        totalBytes: bytes?.total,
        file,
      });
    });

  if (params.useCloning) {
    builder.cloning(true);
  } else {
    builder.voice(params.voiceId);
  }

  await builder.load();
  return builder;
}

async function getOrLoadTtsEngineAndClone(params: {
  language: string;
  accent?: string;
  gender?: string;
  sampleText: string;
  effectiveSpeed: number;
  isCustomClone: boolean;
  cloneSourceUrl?: string;
  cloneProfileKey?: string;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
  onStage?: (stage: string) => void;
}): Promise<{
  tts: MoonshineWasm.TextToSpeech;
  resolvedLanguage: string;
  moonshineLanguage: string;
  voiceId: string;
  usedCloning: boolean;
  effectiveSpeed: number;
}> {
  // Always release any heavy STT model first so STT + TTS ORT graphs don't exhaust WASM heap simultaneously
  releaseCachedTranscriber();

  const { ns, mod } = await getMoonshineModule();

  const resolved = resolveMoonshineVoiceSelection({
    language: params.language,
    accent: params.accent,
    gender: params.gender,
    scriptText: params.sampleText,
  });

  let useCloning = Boolean(
    params.isCustomClone &&
      params.cloneSourceUrl &&
      canUseZipVoiceCloningForLanguage(mod, resolved.moonshineLanguage)
  );

  const loadWithFallback = async (allowCloning: boolean): Promise<{
    tts: MoonshineWasm.TextToSpeech;
    actuallyCloned: boolean;
  }> => {
    const engineKey = allowCloning
      ? `clone:${resolved.moonshineLanguage}`
      : `catalog:${resolved.moonshineLanguage}:${resolved.voiceId}:${params.effectiveSpeed.toFixed(2)}`;

    let tts: MoonshineWasm.TextToSpeech;
    if (activeTtsCache && activeTtsCache.key === engineKey) {
      tts = activeTtsCache.instance;
      params.onProgress?.({ fraction: 1, loadedBytes: 1, totalBytes: 1, file: 'cached' });
    } else {
      releaseCachedTts();
      await new Promise((r) => setTimeout(r, 25));

      params.onStage?.(
        allowCloning
          ? 'Loading Moonshine ZipVoice zero-shot cloning engine...'
          : `Loading Moonshine ${resolved.resolvedLanguage.toUpperCase()} neural voice...`
      );

      tts = await buildAndLoadTtsInstance({
        ns,
        mod,
        moonshineLanguage: resolved.moonshineLanguage,
        voiceId: resolved.voiceId,
        effectiveSpeed: params.effectiveSpeed,
        useCloning: allowCloning,
        onProgress: params.onProgress,
      });

      activeTtsCache = {
        key: engineKey,
        instance: tts,
        cloningMode: allowCloning,
      };
    }

    if (allowCloning && params.cloneSourceUrl) {
      const cloneKey = `${params.cloneProfileKey || params.cloneSourceUrl}`;
      if (activeTtsCache?.lastCloneKey !== cloneKey || !tts.isCloned) {
        params.onStage?.('Conditioning & extracting vocal timbre from cloned reference sample...');
        const sampleRes = await fetch(params.cloneSourceUrl);
        if (!sampleRes.ok) {
          throw new Error('Could not load cloned voice reference sample audio.');
        }
        const sampleBlob = await sampleRes.blob();
        const { pcm16k } = await decodeBlobTo16kMonoPcm(sampleBlob);
        const preparedPcm = prepareCloneReferencePcm(pcm16k);
        await tts.cloneFrom({ audio: preparedPcm, sampleRate: 16000 });
        if (activeTtsCache) {
          activeTtsCache.lastCloneKey = cloneKey;
        }
      }
      return { tts, actuallyCloned: true };
    }

    return { tts, actuallyCloned: false };
  };

  try {
    const { tts, actuallyCloned } = await loadWithFallback(useCloning);
    return {
      tts,
      resolvedLanguage: resolved.resolvedLanguage,
      moonshineLanguage: resolved.moonshineLanguage,
      voiceId: actuallyCloned ? 'zipvoice-clone' : resolved.voiceId,
      usedCloning: actuallyCloned,
      effectiveSpeed: params.effectiveSpeed,
    };
  } catch (firstErr) {
    // Cleanly dispose any corrupted/OOM WASM engine before retrying
    releaseCachedTts();
    await new Promise((r) => setTimeout(r, 60));

    if (useCloning) {
      // Retry ZipVoice cleanly once; if ZipVoice still rejects this clip/environment, gracefully use matching Studio gender voice
      try {
        const { tts, actuallyCloned } = await loadWithFallback(true);
        return {
          tts,
          resolvedLanguage: resolved.resolvedLanguage,
          moonshineLanguage: resolved.moonshineLanguage,
          voiceId: actuallyCloned ? 'zipvoice-clone' : resolved.voiceId,
          usedCloning: actuallyCloned,
          effectiveSpeed: params.effectiveSpeed,
        };
      } catch (retryCloneErr) {
        console.warn('[Moonshine TTS] ZipVoice clone conditioning failed, falling back to studio voice:', retryCloneErr);
        releaseCachedTts();
        await new Promise((r) => setTimeout(r, 60));
        useCloning = false;
      }
    }

    try {
      const { tts } = await loadWithFallback(false);
      return {
        tts,
        resolvedLanguage: resolved.resolvedLanguage,
        moonshineLanguage: resolved.moonshineLanguage,
        voiceId: resolved.voiceId,
        usedCloning: false,
        effectiveSpeed: params.effectiveSpeed,
      };
    } catch (finalErr) {
      throw formatMoonshineTtsError(
        finalErr || firstErr,
        `loading ${resolved.resolvedLanguage.toUpperCase()} neural voice engine`
      );
    }
  }
}

async function synthesizePhraseWithRecovery(params: {
  ttsRef: { current: MoonshineWasm.TextToSpeech; usedCloning: boolean; voiceId: string };
  phraseText: string;
  reloadParams: {
    language: string;
    accent?: string;
    gender?: string;
    sampleText: string;
    effectiveSpeed: number;
    isCustomClone: boolean;
    cloneSourceUrl?: string;
    cloneProfileKey?: string;
    onProgress?: (progress: MoonshineDownloadProgress) => void;
    onStage?: (stage: string) => void;
  };
  contextLabel: string;
}): Promise<{ audio: Float32Array; sampleRate: number }> {
  const clean = sanitizeTtsSpeakableText(params.phraseText);
  if (!clean) {
    return { audio: new Float32Array(0), sampleRate: 24000 };
  }

  try {
    return await synthesizePhraseViaWorkerOrMain(params.ttsRef.current, clean);
  } catch (firstErr) {
    console.warn(`[Moonshine TTS] Recovering phrase (${params.contextLabel}):`, firstErr);
    // Strip any subtle punctuation/quotes except spaces & basic sentence terminators and reload clean TTS state once
    const simplified = clean
      .replace(/["'()\[\]{}:;/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!simplified || !hasSpeakableText(simplified)) {
      return { audio: new Float32Array(0), sampleRate: 24000 };
    }

    releaseCachedTts();
    await new Promise((r) => setTimeout(r, 60));

    try {
      const reloaded = await getOrLoadTtsEngineAndClone(params.reloadParams);
      params.ttsRef.current = reloaded.tts;
      params.ttsRef.usedCloning = reloaded.usedCloning;
      params.ttsRef.voiceId = reloaded.voiceId;
      return await synthesizePhraseViaWorkerOrMain(params.ttsRef.current, simplified);
    } catch (secondErr) {
      if (params.reloadParams.isCustomClone) {
        console.warn(`[Moonshine TTS] ZipVoice synthesis failed for ${params.contextLabel}, falling back to studio voice:`, secondErr);
        releaseCachedTts();
        await new Promise((r) => setTimeout(r, 60));
        try {
          const studioReloaded = await getOrLoadTtsEngineAndClone({
            ...params.reloadParams,
            isCustomClone: false,
            cloneSourceUrl: undefined,
          });
          params.ttsRef.current = studioReloaded.tts;
          params.ttsRef.usedCloning = studioReloaded.usedCloning;
          params.ttsRef.voiceId = studioReloaded.voiceId;
          return await synthesizePhraseViaWorkerOrMain(params.ttsRef.current, simplified);
        } catch (thirdErr) {
          throw formatMoonshineTtsError(thirdErr, `synthesizing ${params.contextLabel}`);
        }
      }
      throw formatMoonshineTtsError(secondErr, `synthesizing ${params.contextLabel}`);
    }
  }
}

export async function synthesizeWithMoonshineTts(params: {
  script: string;
  language: string;
  accent?: string;
  gender?: string;
  tone?: VoiceTone;
  speed?: number;
  naturalBreaths?: boolean;
  isCustomClone?: boolean;
  cloneSourceUrl?: string;
  cloneProfileKey?: string;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
  onStage?: (stage: string) => void;
}): Promise<MoonshineTtsResult> {
  const sanitizedScript = sanitizeTtsSpeakableText(params.script);
  if (!sanitizedScript) {
    throw new Error('Please enter readable speech text to synthesize.');
  }

  const toneProfile = TONE_PACING_PROFILES[params.tone || 'natural'];
  const requestedSpeed = Math.max(0.65, Math.min(1.6, Number(params.speed) || 1.0));
  const useNaturalBreaths = params.naturalBreaths !== false;
  const effectiveSpeed = Math.max(
    0.65,
    Math.min(1.5, requestedSpeed * (useNaturalBreaths ? toneProfile.speedBias : 1.0))
  );

  const reloadParams = {
    language: params.language,
    accent: params.accent,
    gender: params.gender,
    sampleText: sanitizedScript,
    effectiveSpeed,
    isCustomClone: Boolean(params.isCustomClone && params.cloneSourceUrl),
    cloneSourceUrl: params.cloneSourceUrl,
    cloneProfileKey: params.cloneProfileKey,
    onProgress: params.onProgress,
    onStage: params.onStage,
  };

  const loaded = await getOrLoadTtsEngineAndClone(reloadParams);
  const ttsRef = {
    current: loaded.tts,
    usedCloning: loaded.usedCloning,
    voiceId: loaded.voiceId,
  };

  let rawPhrases: NaturalPhraseChunk[] = [];
  if (useNaturalBreaths) {
    rawPhrases = splitIntoNaturalPhrases(params.script);
  } else {
    try {
      rawPhrases = ttsRef.current.splitUtterances(sanitizedScript).flatMap((t, i, arr) =>
        splitOversizedTtsText(sanitizeTtsSpeakableText(t), 185).map((piece, pIdx, pArr) => ({
          text: piece,
          breakAfter: (i < arr.length - 1 && pIdx === pArr.length - 1
            ? 'sentence'
            : pIdx < pArr.length - 1
            ? 'clause'
            : 'none') as NaturalPhraseChunk['breakAfter'],
        }))
      );
    } catch {
      rawPhrases = splitIntoNaturalPhrases(sanitizedScript);
    }
  }

  const chunksToSpeak: NaturalPhraseChunk[] =
    rawPhrases.length > 0
      ? rawPhrases
      : splitOversizedTtsText(sanitizedScript, 185).map((t, i, arr) => ({
          text: t,
          breakAfter: (i < arr.length - 1 ? 'clause' : 'none') as NaturalPhraseChunk['breakAfter'],
        }));

  const sequenceItems: Array<{ pcm: Float32Array; pauseAfterSec: number; addBreath?: boolean }> = [];
  let sampleRate = 24000;

  for (let i = 0; i < chunksToSpeak.length; i++) {
    const chunk = chunksToSpeak[i];
    if (!hasSpeakableText(chunk.text)) continue;

    params.onStage?.(
      chunksToSpeak.length > 1
        ? `Synthesizing phrase ${i + 1} of ${chunksToSpeak.length} locally...`
        : 'Synthesizing voiceover locally on Moonshine WASM...'
    );
    await new Promise((resolve) => setTimeout(resolve, 8));

    const res = await synthesizePhraseWithRecovery({
      ttsRef,
      phraseText: chunk.text,
      reloadParams,
      contextLabel: `phrase ${i + 1} ("${chunk.text.slice(0, 36)}")`,
    });

    sampleRate = res.sampleRate || 24000;
    if (res.audio && res.audio.length > 0) {
      const processed = postProcessSynthesizedPhrasePcm({
        rawAudio: res.audio,
        sampleRate,
        phraseText: chunk.text,
        targetSpeed: effectiveSpeed,
        maxNaturalWpm: toneProfile.maxNaturalWpm,
        usedCloning: ttsRef.usedCloning,
      });

      const pauseSec =
        chunk.breakAfter !== 'none'
          ? useNaturalBreaths
            ? getPauseDurationForBreak(chunk.breakAfter, toneProfile.pauseScale, effectiveSpeed)
            : 0.22
          : 0;

      sequenceItems.push({
        pcm: processed,
        pauseAfterSec: pauseSec,
        addBreath:
          useNaturalBreaths && (chunk.breakAfter === 'sentence' || chunk.breakAfter === 'paragraph'),
      });
    }
  }

  if (sequenceItems.length === 0) {
    throw new Error('No speakable audio could be synthesized from the supplied script.');
  }

  const fullPcm = composeNaturalPcmSequence(sequenceItems, sampleRate);
  const durationSeconds = Math.max(1, Number((fullPcm.length / sampleRate).toFixed(2)));
  const audioBlob = float32PcmToWavBlob(fullPcm, sampleRate);
  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioBlob,
    audioUrl,
    sampleRate,
    durationSeconds,
    voiceId: ttsRef.voiceId,
    language: loaded.resolvedLanguage,
    usedCloning: ttsRef.usedCloning,
  };
}

/**
 * Synthesizes a multi-speaker and/or timestamped dialogue timeline (from .SRT / .VTT / Platform Subtitles).
 * Sanitizes & batches cues per speaker voice profile so ZipVoice cloning executes once per speaker,
 * synthesizes via Web Worker without duplicating WASM memory, and restores exact .SRT turn timing!
 */
export async function synthesizeDialogueTimelineWithMoonshine(params: {
  cues: StructuredSubtitleCue[];
  speakerVoiceMap: Record<string, VoiceProfile>;
  fallbackVoice?: VoiceProfile;
  language: string;
  accent?: string;
  tone?: VoiceTone;
  speed?: number;
  naturalBreaths?: boolean;
  onProgress?: (progress: MoonshineDownloadProgress) => void;
  onStage?: (stage: string) => void;
}): Promise<MoonshineTtsResult> {
  // Sanitize cue texts upfront and filter out pure SFX / empty / bracket-only cues
  const validCues = params.cues
    .map((cue) => ({
      ...cue,
      text: sanitizeTtsSpeakableText(cue.text || ''),
    }))
    .filter((c) => c.text.length > 0);

  if (validCues.length === 0) {
    throw new Error('No speakable subtitle cues found in dialogue timeline.');
  }

  const toneProfile = TONE_PACING_PROFILES[params.tone || 'natural'];
  const requestedSpeed = Math.max(0.65, Math.min(1.6, Number(params.speed) || 1.0));
  const useNaturalBreaths = params.naturalBreaths !== false;
  const effectiveSpeed = Math.max(
    0.65,
    Math.min(1.5, requestedSpeed * (useNaturalBreaths ? toneProfile.speedBias : 1.0))
  );

  // Group cue indices by assigned voice profile so ZipVoice cloning runs only ONCE per distinct speaker voice
  const voiceBuckets = new Map<
    string,
    { voice: VoiceProfile | undefined; cueIndices: number[] }
  >();

  validCues.forEach((cue, idx) => {
    const assigned = params.speakerVoiceMap[cue.speaker] || params.fallbackVoice;
    const bucketKey = assigned ? String(assigned.id) : '__default__';
    const existing = voiceBuckets.get(bucketKey);
    if (existing) {
      existing.cueIndices.push(idx);
    } else {
      voiceBuckets.set(bucketKey, { voice: assigned, cueIndices: [idx] });
    }
  });

  const synthesizedCuePcms = new Array<Float32Array>(validCues.length);
  let masterSampleRate = 24000;
  let anyUsedCloning = false;
  let primaryLang = params.language;
  let primaryVoiceId = 'moonshine-multi';

  let completedCues = 0;
  let successfulCues = 0;
  const totalCues = validCues.length;

  for (const [, bucket] of voiceBuckets) {
    const voice = bucket.voice;
    const isCustomClone = Boolean(voice?.isCustom);
    const cloneUrl =
      voice?.sampleAudioUrl || (voice?.id ? `/api/voices/${voice.id}/sample` : undefined);
    const sampleScript = bucket.cueIndices.map((ci) => validCues[ci].text).join(' ');
    const voiceGender =
      voice?.gender && voice.gender !== 'custom'
        ? voice.gender
        : voice?.vocalFingerprint?.detectedGender || 'male';

    params.onStage?.(
      isCustomClone
        ? `Conditioning cloned voice "${voice?.name || 'Custom'}" for ${bucket.cueIndices.length} cue(s)...`
        : `Preparing voice "${voice?.name || 'Studio'}" for ${bucket.cueIndices.length} cue(s)...`
    );

    const reloadParams = {
      language: params.language,
      accent: params.accent,
      gender: voiceGender,
      sampleText: sampleScript,
      effectiveSpeed,
      isCustomClone,
      cloneSourceUrl: cloneUrl,
      cloneProfileKey: voice ? String(voice.id) : undefined,
      onProgress: params.onProgress,
      onStage: params.onStage,
    };

    const loaded = await getOrLoadTtsEngineAndClone(reloadParams);
    const ttsRef = {
      current: loaded.tts,
      usedCloning: loaded.usedCloning,
      voiceId: loaded.voiceId,
    };

    if (ttsRef.usedCloning) anyUsedCloning = true;
    primaryLang = loaded.resolvedLanguage;
    primaryVoiceId = bucket.cueIndices.length === totalCues ? ttsRef.voiceId : 'moonshine-multi-speaker';

    for (const cueIdx of bucket.cueIndices) {
      const cue = validCues[cueIdx];
      completedCues += 1;
      params.onStage?.(
        `Synthesizing cue ${completedCues}/${totalCues} (${cue.speaker} · ${voice?.name || 'Studio'})...`
      );

      const phrases = useNaturalBreaths
        ? splitIntoNaturalPhrases(cue.text)
        : splitOversizedTtsText(cue.text, 185).map((t, i, arr) => ({
            text: t,
            breakAfter: (i < arr.length - 1 ? 'clause' : 'none') as NaturalPhraseChunk['breakAfter'],
          }));

      const targetPhrases =
        phrases.length > 0
          ? phrases
          : splitOversizedTtsText(cue.text, 185).map((t, i, arr) => ({
              text: t,
              breakAfter: (i < arr.length - 1 ? 'clause' : 'none') as NaturalPhraseChunk['breakAfter'],
            }));

      const cueParts: Array<{ pcm: Float32Array; pauseAfterSec: number; addBreath?: boolean }> = [];
      for (const phrase of targetPhrases) {
        if (!hasSpeakableText(phrase.text)) continue;
        await new Promise((resolve) => setTimeout(resolve, 6));

        try {
          const res = await synthesizePhraseWithRecovery({
            ttsRef,
            phraseText: phrase.text,
            reloadParams,
            contextLabel: `cue #${cueIdx + 1} (${cue.speaker})`,
          });

          if (ttsRef.usedCloning) anyUsedCloning = true;
          masterSampleRate = res.sampleRate || 24000;
          if (res.audio && res.audio.length > 0) {
            const processed = postProcessSynthesizedPhrasePcm({
              rawAudio: res.audio,
              sampleRate: masterSampleRate,
              phraseText: phrase.text,
              targetSpeed: effectiveSpeed,
              maxNaturalWpm: toneProfile.maxNaturalWpm,
              usedCloning: ttsRef.usedCloning,
            });
            cueParts.push({
              pcm: processed,
              pauseAfterSec:
                phrase.breakAfter !== 'none'
                  ? getPauseDurationForBreak(phrase.breakAfter, toneProfile.pauseScale, effectiveSpeed)
                  : 0,
              addBreath:
                useNaturalBreaths &&
                (phrase.breakAfter === 'sentence' || phrase.breakAfter === 'paragraph'),
            });
          }
        } catch (cueErr) {
          // If prior cues succeeded and a single malformed subtitle cue fails even after recovery,
          // preserve scalability across large .SRT batches instead of discarding the entire render.
          if (successfulCues > 0) {
            console.warn(`[Moonshine SRT] Skipped unpronounceable cue #${cueIdx + 1}:`, cueErr);
            cueParts.push({
              pcm: createNaturalPauseGapPcm(0.45, masterSampleRate, { addBreath: false, seedOffset: cueIdx + 17 }),
              pauseAfterSec: 0,
            });
          } else {
            throw cueErr;
          }
        }
      }

      if (cueParts.length > 0) {
        synthesizedCuePcms[cueIdx] = composeNaturalPcmSequence(cueParts, masterSampleRate);
        if (synthesizedCuePcms[cueIdx].length > 0) {
          successfulCues += 1;
        }
      } else {
        synthesizedCuePcms[cueIdx] = new Float32Array(0);
      }
    }
  }

  if (successfulCues === 0) {
    throw new Error('Could not synthesize any audio from the subtitle cues. Please check the script language and text.');
  }

  // Assemble synthesized cues in exact chronological timeline order, honoring .SRT gaps & speaker turns
  const timelineParts: Float32Array[] = [];
  const alignedSegments: TranscriptSegment[] = [];
  let cursorSamples = 0;

  if (validCues[0]?.hasTimestamp && validCues[0].start > 0.08) {
    const leadingPauseSec = Math.min(validCues[0].start, 2.5);
    const leadPcm = createNaturalPauseGapPcm(leadingPauseSec, masterSampleRate, {
      addBreath: useNaturalBreaths && leadingPauseSec >= 0.35,
      seedOffset: 701,
    });
    timelineParts.push(leadPcm);
    cursorSamples += leadPcm.length;
  }

  for (let i = 0; i < validCues.length; i++) {
    const cue = validCues[i];
    const cuePcm = synthesizedCuePcms[i] || new Float32Array(0);
    const segStart = Number((cursorSamples / masterSampleRate).toFixed(2));
    if (cuePcm.length > 0) {
      timelineParts.push(cuePcm);
      cursorSamples += cuePcm.length;
    }
    const segEnd = Number(Math.max(segStart + 0.35, cursorSamples / masterSampleRate).toFixed(2));

    alignedSegments.push({
      id: `vo-cue-${Date.now()}-${i + 1}`,
      start: segStart,
      end: segEnd,
      speaker: cue.speaker || 'Speaker 1',
      text: cue.text,
    });

    if (i < validCues.length - 1) {
      const nextCue = validCues[i + 1];
      const speakerChanged = (nextCue.speaker || 'Speaker 1') !== (cue.speaker || 'Speaker 1');
      const baseTurnPause = (speakerChanged ? 0.56 : 0.40) * toneProfile.pauseScale;

      let interCuePauseSec = useNaturalBreaths ? baseTurnPause : 0.25;
      if (cue.hasTimestamp && nextCue.hasTimestamp) {
        const srtGap = nextCue.start - cue.end;
        // Preserve authentic .SRT silent gaps (capped reasonably at 3.5s) while guaranteeing clean turn-taking breath
        interCuePauseSec =
          srtGap > baseTurnPause
            ? Math.min(3.5, srtGap)
            : Math.max(speakerChanged ? 0.42 : 0.30, baseTurnPause);
      }

      const gapPcm = createNaturalPauseGapPcm(interCuePauseSec, masterSampleRate, {
        addBreath: useNaturalBreaths,
        seedOffset: 900 + i * 53,
      });
      timelineParts.push(gapPcm);
      cursorSamples += gapPcm.length;
    }
  }

  params.onStage?.('Finalizing multi-speaker studio WAV audio...');
  const fullPcm = concatPcmChunks(timelineParts);
  const durationSeconds = Math.max(1, Number((fullPcm.length / masterSampleRate).toFixed(2)));
  const audioBlob = float32PcmToWavBlob(fullPcm, masterSampleRate);
  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioBlob,
    audioUrl,
    sampleRate: masterSampleRate,
    durationSeconds,
    voiceId: primaryVoiceId,
    language: primaryLang,
    usedCloning: anyUsedCloning,
    segments: alignedSegments,
  };
}
