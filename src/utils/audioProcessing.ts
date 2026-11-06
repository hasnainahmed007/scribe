/**
 * Audio Processing Utilities
 * Provides Web Audio API decoding, exact duration detection, and universal WAV conversion
 * for seamless HTML5 <audio> playback across all browsers (including WhatsApp .ogg/Opus voice notes).
 */

export interface ProcessedAudioResult {
  url: string;
  duration: number;
  blob: Blob;
  mimeType: string;
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob (audio/wav).
 * Universally supported by HTML5 <audio> in Chrome, Safari, Firefox, Edge, and iOS.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // Uncompressed PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataByteLength = numSamples * blockAlign;
  const headerByteLength = 44;
  const totalByteLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalByteLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF container descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Write interleaved 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      // Scale float32 [-1.0, 1.0] to int16 [-32768, 32767]
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Decodes any audio File or Blob (Ogg, Opus, WebM, MP3, M4A, WAV) using Web Audio API,
 * extracting the true mathematical duration and converting Ogg/Opus to clean playable WAV.
 */
export async function preparePlayableAudio(
  fileOrBlob: Blob,
  fileName?: string,
  fallbackDuration?: number
): Promise<ProcessedAudioResult> {
  const name = fileName || (fileOrBlob instanceof File ? fileOrBlob.name : 'audio.wav');
  const isOggOrOpus =
    name.toLowerCase().endsWith('.ogg') ||
    name.toLowerCase().endsWith('.opus') ||
    name.toLowerCase().endsWith('.webm') ||
    fileOrBlob.type.includes('ogg') ||
    fileOrBlob.type.includes('opus') ||
    fileOrBlob.type.includes('webm') ||
    !fileOrBlob.type.startsWith('audio/');

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const arrayBuffer = await fileOrBlob.arrayBuffer();

      // Decode the compressed or raw audio data into PCM AudioBuffer
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const exactDuration = audioBuffer.duration;

      // Close temporary decoding audio context
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }

      const validDuration =
        Number.isFinite(exactDuration) && exactDuration > 0
          ? exactDuration
          : fallbackDuration && fallbackDuration > 0
          ? fallbackDuration
          : 60;

      // For OGG, Opus, or non-standard containers, convert to universal WAV
      // so HTML5 <audio> can seek, play, and report duration flawlessly without browser codec bugs.
      if (isOggOrOpus) {
        const wavBlob = audioBufferToWavBlob(audioBuffer);
        const wavUrl = URL.createObjectURL(wavBlob);
        return {
          url: wavUrl,
          duration: validDuration,
          blob: wavBlob,
          mimeType: 'audio/wav',
        };
      }

      // Standard MP3 or WAV can use direct ObjectURL
      const directUrl = URL.createObjectURL(fileOrBlob);
      return {
        url: directUrl,
        duration: validDuration,
        blob: fileOrBlob,
        mimeType: fileOrBlob.type || 'audio/mp3',
      };
    }
  } catch (err) {
    console.warn('[AudioProcessor] Web Audio API decoding failed, falling back to direct URL:', err);
  }

  // Fallback: direct blob URL with duration estimation
  const fallbackUrl = URL.createObjectURL(fileOrBlob);
  const detectedDuration = await inspectAudioDuration(fallbackUrl, fallbackDuration || 60);

  return {
    url: fallbackUrl,
    duration: detectedDuration,
    blob: fileOrBlob,
    mimeType: fileOrBlob.type || 'audio/mp3',
  };
}

/**
 * In-browser HTML5 Audio element metadata inspector as a fallback.
 */
function inspectAudioDuration(audioUrl: string, fallback: number): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = audioUrl;

    let resolved = false;
    const finish = (val: number) => {
      if (resolved) return;
      resolved = true;
      audio.src = '';
      resolve(Number.isFinite(val) && val > 0 ? val : fallback);
    };

    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(fallback);
    setTimeout(() => finish(audio.duration || fallback), 1200);
  });
}
