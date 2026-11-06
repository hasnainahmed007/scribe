import { TranscriptSegment } from '../types';

export interface SampleAudioItem {
  id: string;
  title: string;
  category: string;
  duration: number;
  durationFormatted: string;
  description: string;
  audioUrl: string;
  fullTranscript: string;
  summary: string;
  segments: TranscriptSegment[];
}

/**
 * Generates a clean synthetic audio tone or synthesized wave for instant client-side testing
 */
export function generateSyntheticAudioBlob(durationSeconds: number = 22): Blob {
  // Create an in-memory WAV buffer containing a soft, pleasant acoustic chord progression
  const sampleRate = 22050;
  const numChannels = 1;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples with simulated speech melody tones
  const frequencies = [220, 247, 261, 293, 329, 349, 392, 440];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freqIdx = Math.floor((t * 1.5) % frequencies.length);
    const freq = frequencies[freqIdx];
    // Gentle envelope with speech cadence pauses
    const cadence = Math.sin(t * Math.PI * 3);
    const amp = cadence > 0.1 ? 0.35 : 0.05;
    const sample = Math.sin(2 * Math.PI * freq * t) * amp * 32767;
    view.setInt16(44 + i * 2, Math.floor(sample), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const SAMPLE_AUDIOS: SampleAudioItem[] = [
  {
    id: 'sample-tech',
    title: 'AI Masterclass: Top Multimodal Audio & Video Creator Tools (2026)',
    category: 'Tech & Media',
    duration: 24,
    durationFormatted: '00:24',
    description: 'An in-depth breakdown of how modern AI accelerates voice transcription and subtitle generation across any spoken language.',
    audioUrl: '', // generated dynamically on client
    summary: 'This episode explores how multimodal artificial intelligence empowers creators to transcribe multilingual audio with timestamps, export universal SRT/DOCX files, and boost workflow efficiency by up to 80%.',
    fullTranscript: 'Welcome to today’s creator tech masterclass. Today, we are exploring the most powerful AI speech intelligence tools available in 2026. For content creators, podcasters, and YouTube producers publishing videos globally, automated multilingual audio transcription and subtitle editing have become indispensable. With high-fidelity speech recognition supporting every global language, your production turnaround time drops dramatically. Let’s jump straight into the workflow.',
    segments: [
      {
        id: 'seg-1',
        start: 0.0,
        end: 4.8,
        speaker: 'Alex (Host)',
        text: 'Welcome to today’s creator tech masterclass.',
      },
      {
        id: 'seg-2',
        start: 4.8,
        end: 10.2,
        speaker: 'Alex (Host)',
        text: 'Today, we are exploring the most powerful AI speech intelligence tools available in 2026.',
      },
      {
        id: 'seg-3',
        start: 10.2,
        end: 16.5,
        speaker: 'Alex (Host)',
        text: 'For creators publishing videos globally, automated multilingual transcription and subtitle editing have become indispensable.',
      },
      {
        id: 'seg-4',
        start: 16.5,
        end: 21.3,
        speaker: 'Alex (Host)',
        text: 'With high-fidelity speech recognition supporting every global language, your turnaround time drops dramatically.',
      },
      {
        id: 'seg-5',
        start: 21.3,
        end: 24.0,
        speaker: 'Alex (Host)',
        text: 'Let’s jump straight into the workflow.',
      },
    ],
  },
  {
    id: 'sample-growth',
    title: 'YouTube Growth Blueprint: Mastering Click-Through Rate & AI SEO',
    category: 'Audience Strategy',
    duration: 20,
    durationFormatted: '00:20',
    description: 'Actionable strategies for optimizing thumbnail contrast, headlines, and keyword-rich chapter timestamps.',
    audioUrl: '',
    summary: 'A tactical guide on driving viral reach and audience retention on YouTube using high-contrast 16:9 thumbnail design, optimized titles, and automated description chapters.',
    fullTranscript: 'To succeed on modern video platforms, pair top-tier audio quality with irresistible thumbnails and titles. When viewers see clean, high-contrast typography and a compelling visual hook in their feed, click-through rates climb immediately. Combine that with accurate subtitles and search-optimized chapter timestamps to maximize watch time.',
    segments: [
      {
        id: 'growth-1',
        start: 0.0,
        end: 5.6,
        speaker: 'Marcus (Strategist)',
        text: 'To succeed on modern video platforms, pair top-tier audio quality with irresistible thumbnails and titles.',
      },
      {
        id: 'growth-2',
        start: 5.6,
        end: 13.8,
        speaker: 'Marcus (Strategist)',
        text: 'When viewers see clean, high-contrast typography and a compelling visual hook in their feed, click-through rates climb immediately.',
      },
      {
        id: 'growth-3',
        start: 13.8,
        end: 20.0,
        speaker: 'Marcus (Strategist)',
        text: 'Combine that with accurate subtitles and search-optimized chapter timestamps to maximize watch time.',
      },
    ],
  },
];
