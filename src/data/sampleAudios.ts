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
    title: 'টেক রিভিউ: ২০২৬ সালের শীর্ষ এআই টুলস ও ক্রিয়েটর গ্যাজেট',
    category: 'প্রযুক্তি ও গ্যাজেট',
    duration: 24,
    durationFormatted: '00:24',
    description: 'আধুনিক কন্টেন্ট ক্রিয়েশনের জন্য প্রয়োজনীয় ৫টি অত্যাধুনিক এআই প্রযুক্তি নিয়ে বিস্তারিত আলোচনা।',
    audioUrl: '', // generated dynamically on client
    summary: 'এই পর্বে ২০২৬ সালে ইউটিউব ও ভিডিও কন্টেন্ট তৈরিতে কৃত্রিম বুদ্ধিমত্তা বা AI কীভাবে কাজের গতি বহুগুণ বাড়িয়ে দিচ্ছে এবং বাংলা ভাষায় নির্ভুল ভয়েস টাইপিংয়ের গুরুত্ব তুলে ধরা হয়েছে।',
    fullTranscript: 'আসসালামু আলাইকুম এবং স্বাগতম আমাদের আজকের বিশেষ টেক রিভিউ পর্বে। আজকে আমরা কথা বলব ২০২৬ সালের সবচেয়ে কার্যকরী কিছু এআই টুলস নিয়ে, যা প্রতিটি কন্টেন্ট ক্রিয়েটরের জানা অত্যন্ত জরুরি। বিশেষ করে যারা নিয়মিত ইউটিউব বা সোশ্যাল মিডিয়ার জন্য ভিডিও বানান, তাদের জন্য অডিও ট্রান্সক্রিপশন এবং অটোমেটিক সাবটাইটেল জেনারেশন এখন সবচেয়ে বড় গেম চেঞ্জার। বাংলা ভাষায় নির্ভুল ভয়েস টু টেক্সট প্রযুক্তির মাধ্যমে আপনার কাজের সময় প্রায় আশি শতাংশ পর্যন্ত কমে যেতে পারে। চলুন দেরি না করে বিস্তারিত দেখে নেওয়া যাক।',
    segments: [
      {
        id: 'seg-1',
        start: 0.0,
        end: 4.8,
        speaker: 'তাহসিন (হোস্ট)',
        text: 'আসসালামু আলাইকুম এবং স্বাগতম আমাদের আজকের বিশেষ টেক রিভিউ পর্বে।',
      },
      {
        id: 'seg-2',
        start: 4.8,
        end: 10.2,
        speaker: 'তাহসিন (হোস্ট)',
        text: 'আজকে আমরা কথা বলব ২০২৬ সালের সবচেয়ে কার্যকরী কিছু এআই টুলস নিয়ে, যা প্রতিটি কন্টেন্ট ক্রিয়েটরের জানা অত্যন্ত জরুরি।',
      },
      {
        id: 'seg-3',
        start: 10.2,
        end: 16.5,
        speaker: 'তাহসিন (হোস্ট)',
        text: 'বিশেষ করে যারা নিয়মিত ইউটিউব বা সোশ্যাল মিডিয়ার জন্য ভিডিও বানান, তাদের জন্য অডিও ট্রান্সক্রিপশন এখন সবচেয়ে বড় গেম চেঞ্জার।',
      },
      {
        id: 'seg-4',
        start: 16.5,
        end: 21.3,
        speaker: 'তাহসিন (হোস্ট)',
        text: 'বাংলা ভাষায় নির্ভুল ভয়েস টু টেক্সট প্রযুক্তির মাধ্যমে আপনার কাজের সময় প্রায় আশি শতাংশ পর্যন্ত কমে যেতে পারে।',
      },
      {
        id: 'seg-5',
        start: 21.3,
        end: 24.0,
        speaker: 'তাহসিন (হোস্ট)',
        text: 'চলুন দেরি না করে বিস্তারিত দেখে নেওয়া যাক।',
      },
    ],
  },
  {
    id: 'sample-growth',
    title: 'ইউটিউব গ্রোথ: প্রথম ১ লক্ষ সাবস্ক্রাইবার অর্জনের কার্যকরী কৌশল',
    category: 'ইউটিউব স্ট্র্যাটেজি',
    duration: 20,
    durationFormatted: '00:20',
    description: 'নতুন ইউটিউবারদের জন্য ক্লিক রেট বাড়ানো এবং সঠিক থাম্বনেল ও টাইটেল নির্বাচনের বৈজ্ঞানিক নিয়ম।',
    audioUrl: '',
    summary: 'ইউটিউব ভিডিওর রিচ এবং ক্লিক থ্রু রেট (CTR) বৃদ্ধির জন্য আকর্ষক বাংলা থাম্বনেল এবং কিওয়ার্ডসমৃদ্ধ টাইটেল ব্যবহারের গুরুত্ব আলোচনা।',
    fullTranscript: 'ইউটিউবে সফলতা পাওয়ার জন্য ভিডিও কোয়ালিটির পাশাপাশি সবচেয়ে গুরুত্বপূর্ণ বিষয় হলো আকর্ষক থাম্বনেল এবং টাইটেল। দর্শক যখন আপনার ভিডিওর থাম্বনেলে নজরকাড়া ফন্ট এবং পরিষ্কার বার্তা দেখতে পান, তখনই ক্লিক করার সম্ভাবনা বহুগুণ বেড়ে যায়। তাই নিয়মিত অডিয়েন্স রিটেনশন ও এসইও কিওয়ার্ডের দিকে খেয়াল রাখুন।',
    segments: [
      {
        id: 'growth-1',
        start: 0.0,
        end: 5.6,
        speaker: 'রাফিদ (মার্কেটার)',
        text: 'ইউটিউবে সফলতা পাওয়ার জন্য ভিডিও কোয়ালিটির পাশাপাশি সবচেয়ে গুরুত্বপূর্ণ বিষয় হলো আকর্ষক থাম্বনেল এবং টাইটেল।',
      },
      {
        id: 'growth-2',
        start: 5.6,
        end: 13.8,
        speaker: 'রাফিদ (মার্কেটার)',
        text: 'দর্শক যখন আপনার ভিডিওর থাম্বনেলে নজরকাড়া বাংলা ফন্ট এবং পরিষ্কার বার্তা দেখতে পান, তখনই ক্লিক করার সম্ভাবনা বহুগুণ বেড়ে যায়।',
      },
      {
        id: 'growth-3',
        start: 13.8,
        end: 20.0,
        speaker: 'রাফিদ (মার্কেটার)',
        text: 'তাই নিয়মিত অডিয়েন্স রিটেনশন ও এসইও কিওয়ার্ডের সঠিক ব্যবহারের দিকে খেয়াল রাখুন।',
      },
    ],
  },
];
