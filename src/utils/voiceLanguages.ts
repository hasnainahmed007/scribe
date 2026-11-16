import { VoiceGender, VoiceTone } from '../types';

export const CUSTOM_ACCENT_ID = '__custom__';

export interface VoiceAccentOption {
  id: string;
  label: string;
  promptHint: string;
}

export interface VoiceLanguageOption {
  code: string;
  label: string;
  nativeName?: string;
  forSynthesis?: boolean;
  forCloning?: boolean;
  accents: VoiceAccentOption[];
}

export const SAMPLE_SCRIPTS_BY_LANGUAGE: Record<string, string> = {
  en: 'Welcome to Scriby AI Voiceover Studio. This recording demonstrates crisp studio pronunciation, natural pacing, and authentic regional accent delivery.',
  bn: 'আসসালামু আলাইকুম, স্ক্রাইবি এআই ভয়েসওভার স্টুডিওতে আপনাকে স্বাগতম। আজকের এই অডিওতে আমাদের আঞ্চলিক উচ্চারণ ও স্বাভাবিক কণ্ঠস্বর পরীক্ষা করা হচ্ছে।',
  hi: 'नमस्ते, स्क्राइबी एआई वॉइसओवर स्टूडियो में आपका स्वागत है। यह रिकॉर्डिंग स्पष्ट उच्चारण और क्षेत्रीय लहजे का परीक्षण करने के लिए है।',
  ar: 'مرحباً بكم في استوديو سكرايبي للتعليق الصوتي بالذكاء الاصطناعي. يختبر هذا التسجيل وضوح المخارج واللهجة الإقليمية الطبيعية.',
  es: 'Bienvenidos a Scriby AI Voiceover Studio. Esta grabación demuestra una pronunciación clara y un acento regional auténtico.',
  fr: 'Bienvenue dans Scriby AI Voiceover Studio. Cet enregistrement met en valeur une diction claire et un accent régional authentique.',
  pt: 'Bem-vindo ao Scriby AI Voiceover Studio. Esta gravação demonstra uma pronúncia natural e um sotaque regional autêntico.',
  de: 'Willkommen im Scriby AI Voiceover Studio. Diese Aufnahme demonstriert eine klare Aussprache und einen authentischen regionalen Akzent.',
  ja: 'スクリビAIボイスオーバースタジオへようこそ。この音声は自然なイントネーションと発音スタイルをテストしています。',
  ko: '스크라이비 AI 보이스오버 스튜디오에 오신 것을 환영합니다. 이 녹음은 자연스러운 억양과 발음을 테스트합니다.',
  zh: '欢迎来到 Scriby AI 配音工作室。这段录音旨在展示清晰自然的发音以及地道准确的区域口音表现。',
  ur: 'اسکرائیبی اے آئی وائس اوور اسٹوڈیو میں خوش آمدید۔ یہ ریکارڈنگ صاف تلفظ اور علاقائی لہجے کی جانچ کے لیے ہے۔',
  tr: 'Scriby Yapay Zeka Seslendirme Stüdyosuna hoş geldiniz. Bu kayıt akıcı telaffuz ve bölgesel vurgu testidir.',
  it: 'Benvenuti in Scriby AI Voiceover Studio. Questa registrazione dimostra una dizione nitida e un accento regionale autentico.',
};

export function detectScriptCategory(
  text?: string
): 'bengali' | 'devanagari' | 'arabic' | 'japanese' | 'korean' | 'cjk' | 'latin' | 'unknown' {
  if (!text || !text.trim()) return 'unknown';
  if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  if (/[\u3040-\u30FF]/.test(text)) return 'japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'cjk';
  if (/[A-Za-z]/.test(text)) return 'latin';
  return 'unknown';
}

export const VOICE_LANGUAGES: VoiceLanguageOption[] = [
  {
    code: 'auto',
    label: 'Auto-Detect from Script',
    forSynthesis: true,
    forCloning: false,
    accents: [
      {
        id: 'Native / Standard',
        label: 'Native / Standard',
        promptHint: 'Detect the script language automatically and speak with authentic native pronunciation and natural cadence.',
      },
      {
        id: 'Neutral Broadcast Studio',
        label: 'Neutral Broadcast Studio',
        promptHint: 'Speak in the detected script language with crisp, authoritative newsroom broadcast articulation.',
      },
      {
        id: 'Warm Storytelling',
        label: 'Warm Storytelling',
        promptHint: 'Speak in the detected script language with warm, expressive documentary narrative phrasing.',
      },
    ],
  },
  {
    code: 'multilingual',
    label: 'Universal Multilingual (All Languages)',
    forSynthesis: false,
    forCloning: true,
    accents: [
      {
        id: 'Standard Studio',
        label: 'Standard Studio',
        promptHint: 'Adapt naturally to the script language with authentic native pronunciation.',
      },
      {
        id: 'Neutral International',
        label: 'Neutral International',
        promptHint: 'Maintain clear, internationally intelligible pronunciation across languages.',
      },
      {
        id: 'Warm Narrative',
        label: 'Warm Narrative',
        promptHint: 'Expressive storytelling inflection with natural breathing pauses.',
      },
    ],
  },
  {
    code: 'en',
    label: 'English',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'American (General US)',
        label: 'American (General US)',
        promptHint: 'Speak in unmistakable General American English with rhotic /r/, relaxed flap-T, and standard US broadcast cadence.',
      },
      {
        id: 'British (RP / London)',
        label: 'British (RP / London)',
        promptHint: 'Speak in unmistakable British English (London / Received Pronunciation): drop trailing /r/ (non-rhotic), crisp /t/ consonants, broad /ah/ and rounded British vowels.',
      },
      {
        id: 'Australian',
        label: 'Australian',
        promptHint: 'Speak in unmistakable Australian English (Sydney/Melbourne): broad Australian vowel shifts, non-rhotic endings, and relaxed upward Aussie phrase inflection.',
      },
      {
        id: 'Indian English',
        label: 'Indian English',
        promptHint: 'Speak in unmistakable Indian English: crisp syllable-timed rhythm, retroflex /t/ and /d/, rolled /r/, unreduced vowels, and authentic South Asian English prosody.',
      },
      {
        id: 'Irish',
        label: 'Irish',
        promptHint: 'Speak in unmistakable Irish English (Dublin): warm melodic lilt, soft dental /th/ consonants, rounded vowels, and lively Celtic rhythm.',
      },
      {
        id: 'Canadian',
        label: 'Canadian',
        promptHint: 'Speak in natural Canadian English with crisp North American broadcast phrasing and authentic Canadian vowel raising.',
      },
      {
        id: 'Scottish',
        label: 'Scottish',
        promptHint: 'Speak in unmistakable Scottish English (Edinburgh/Glasgow): tapped/rolled rhotic /r/, short pure vowels, and distinct Scottish rising-falling pitch contour.',
      },
    ],
  },
  {
    code: 'bn',
    label: 'Bengali',
    nativeName: 'বাংলা',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Bangladeshi (Dhaka Standard)',
        label: 'Bangladeshi (Dhaka Standard)',
        promptHint: 'Speak in authentic Bangladeshi Dhaka Promito Bangla: grounded warm chest resonance, clear aspirated consonants (kh, bh, dh, ph), natural Dhaka urban conversational rhythm, and typical Bangladeshi sentence melody.',
      },
      {
        id: 'West Bengal (Kolkata Standard)',
        label: 'West Bengal (Kolkata Standard)',
        promptHint: 'Speak in unmistakable West Bengal Kolkata Bangla (urban Ghoti accent): bright forward tongue placement, soft crisp sibilants, distinctly lyrical rising Kolkata vowel intonation at phrase endings, and crisp West Bengal articulation.',
      },
      {
        id: 'Sylheti-inflected Warm',
        label: 'Sylheti-inflected Warm',
        promptHint: 'Speak Bengali with an unmistakable, strong Sylheti (Sylhet, Bangladesh) regional accent and dialectal prosody: airy fricative softening on k/p stops (Sylheti kh/f coloring), lilting sing-song Sylheti pitch rises, and warm Surma valley folk cadence.',
      },
      {
        id: 'Chittagonian-inflected Neutral',
        label: 'Chittagonian-inflected Neutral',
        promptHint: 'Speak Bengali with an unmistakable, strong Chattogram (Chittagonian) southeastern Bangladeshi regional accent and dialectal prosody: fast punchy clipped syllables, sharp downward Chittagonian tonal drop at clause endings, nasalized open vowels, and coastal Chattogram speech melody.',
      },
      {
        id: 'Classic Literary / Recitation',
        label: 'Classic Literary / Recitation',
        promptHint: 'Speak Bengali in dramatic classical Abritti stage recitation style: deep sustained open vowels, poetic rhythmic pauses, and elevated literary pronunciation.',
      },
    ],
  },
  {
    code: 'hi',
    label: 'Hindi',
    nativeName: 'हिन्दी',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Standard Khari Boli (Delhi / NCR)',
        label: 'Standard Khari Boli (Delhi / NCR)',
        promptHint: 'Speak in authentic Delhi NCR Khari Boli Hindi with crisp retroflex stops, clear aspirated consonants, and natural northern Indian cadence.',
      },
      {
        id: 'Mumbai Conversational',
        label: 'Mumbai Conversational',
        promptHint: 'Speak in unmistakable Mumbai Bambaiya-tinted conversational Hindi with brisk urban rhythm, friendly upward inflections, and relaxed colloquial flow.',
      },
      {
        id: 'Lucknow Polite',
        label: 'Lucknow Polite',
        promptHint: 'Speak in refined Awadhi-influenced Lucknow Hindi (Tahzeeb diction): soft melodic Urdu-Hindi consonants (q, kh, gh, z), measured polite pacing, and warm courtly grace.',
      },
      {
        id: 'Broadcast Formal',
        label: 'Broadcast Formal',
        promptHint: 'Speak in crisp, authoritative Shuddh Hindi documentary and news anchor style.',
      },
    ],
  },
  {
    code: 'ar',
    label: 'Arabic',
    nativeName: 'العربية',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Modern Standard Arabic (Fusha)',
        label: 'Modern Standard Arabic (Fusha)',
        promptHint: 'Speak in crisp Modern Standard Arabic (Al-Fusha) with precise pharyngeal consonants (ayn, ha, qaf) and formal newsroom cadence.',
      },
      {
        id: 'Egyptian (Cairo)',
        label: 'Egyptian (Cairo)',
        promptHint: 'Speak in unmistakable Egyptian Arabic (Cairo Masri): hard /g/ for jeem, bright Cairo vowel melody, warm expressive rhythm, and lively conversational flow.',
      },
      {
        id: 'Gulf (Khaleeji)',
        label: 'Gulf (Khaleeji)',
        promptHint: 'Speak in unmistakable Gulf Arabic (Khaleeji): deep resonant throat consonants, softened qaf/kaf inflection, and measured Arabian Peninsula cadence.',
      },
      {
        id: 'Levantine (Beirut / Damascus)',
        label: 'Levantine (Beirut / Damascus)',
        promptHint: 'Speak in unmistakable Levantine Arabic (Beirut/Damascus Shami): smooth glottal qaf softening, lyrical melodic vowel rises, and gentle Mediterranean rhythm.',
      },
      {
        id: 'Moroccan (Maghrebi)',
        label: 'Moroccan (Maghrebi)',
        promptHint: 'Speak in unmistakable Moroccan Darija / Maghrebi Arabic with crisp consonant clusters, brisk North African rhythm, and authentic Moroccan intonation.',
      },
    ],
  },
  {
    code: 'es',
    label: 'Spanish',
    nativeName: 'Español',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Latin American (Neutral)',
        label: 'Latin American (Neutral)',
        promptHint: 'Speak in clear neutral Latin American Spanish with uniform seseo pronunciation and smooth broadcast pacing.',
      },
      {
        id: 'Mexican',
        label: 'Mexican',
        promptHint: 'Speak in unmistakable Mexican Spanish (CDMX): crisp syllable-final consonants, sing-song central Mexican rising cadence, and warm expressive vowels.',
      },
      {
        id: 'Castilian (Spain / Madrid)',
        label: 'Castilian (Spain / Madrid)',
        promptHint: 'Speak in unmistakable European Castilian Spanish (Madrid): authentic interdental /th/ distinction (ceceo on z/ci/ce), retracted /s/, and brisk Peninsular rhythm.',
      },
      {
        id: 'Colombian (Bogota)',
        label: 'Colombian (Bogota)',
        promptHint: 'Speak in unmistakable Bogota Colombian Spanish: hyper-clear enunciation, gentle melodic pauses, and polite Andean intonation.',
      },
      {
        id: 'Rioplatense (Argentina)',
        label: 'Rioplatense (Argentina)',
        promptHint: 'Speak in unmistakable Argentine Rioplatense Spanish (Buenos Aires): characteristic "sh/zh" sheismo on ll/y and expressive Italianate Buenos Aires pitch contours.',
      },
    ],
  },
  {
    code: 'fr',
    label: 'French',
    nativeName: 'Français',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Metropolitan (Paris Standard)',
        label: 'Metropolitan (Paris Standard)',
        promptHint: 'Speak in authentic Parisian Metropolitan French with uvular /r/, crisp nasal vowels, smooth liaison, and understated Parisian melody.',
      },
      {
        id: 'Canadian (Quebecois)',
        label: 'Canadian (Quebecois)',
        promptHint: 'Speak in unmistakable Quebecois Canadian French: affricated /dz/ and /ts/ before i/u, diphthongized long vowels, and distinct Quebecois rhythmic swing.',
      },
      {
        id: 'Southern French (Marseille)',
        label: 'Southern French (Marseille)',
        promptHint: 'Speak in unmistakable Southern French (Marseille Midi accent): pronounced mute-e syllables, open oral vowels instead of heavy nasals, and sunny Mediterranean cadence.',
      },
      {
        id: 'Belgian / Swiss Neutral',
        label: 'Belgian / Swiss Neutral',
        promptHint: 'Speak in measured Belgian/Swiss French with clear vowel length distinctions and steady studio pacing.',
      },
    ],
  },
  {
    code: 'pt',
    label: 'Portuguese',
    nativeName: 'Português',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Brazilian (Sao Paulo / Rio)',
        label: 'Brazilian (Sao Paulo / Rio)',
        promptHint: 'Speak in unmistakable Brazilian Portuguese: open melodic vowels, palatalized /tʃ/ and /dʒ/ before i/e, musical Brazilian prosody.',
      },
      {
        id: 'European (Lisbon)',
        label: 'European (Lisbon)',
        promptHint: 'Speak in unmistakable European Portuguese (Lisbon): clipped unstressed vowels, palatalized syllable-final "sh/zh", and crisp Continental cadence.',
      },
      {
        id: 'Northeastern Brazilian',
        label: 'Northeastern Brazilian',
        promptHint: 'Speak in unmistakable Northeastern Brazilian Portuguese (Recife/Bahia): open unpalatalized t/d, warm singing intonation, and expressive regional rhythm.',
      },
    ],
  },
  {
    code: 'de',
    label: 'German',
    nativeName: 'Deutsch',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Standard German (Hochdeutsch)',
        label: 'Standard German (Hochdeutsch)',
        promptHint: 'Speak in crisp Standard High German (Hochdeutsch) with clean glottal stops and clear broadcast articulation.',
      },
      {
        id: 'Austrian (Vienna)',
        label: 'Austrian (Vienna)',
        promptHint: 'Speak in unmistakable Viennese Austrian German: softened word-initial consonants, softer rounded vowels, and gentle melodic Austrian cadence.',
      },
      {
        id: 'Swiss Standard German',
        label: 'Swiss Standard German',
        promptHint: 'Speak in unmistakable Swiss High German: guttural ch/k coloring, trilled/clear /r/, and measured rhythmic phrasing.',
      },
      {
        id: 'Bavarian-inflected Warm',
        label: 'Bavarian-inflected Warm',
        promptHint: 'Speak German with a warm Southern Bavarian regional inflection: rolled /r/, softened p/t stops, and friendly Munich phrasing.',
      },
    ],
  },
  {
    code: 'ja',
    label: 'Japanese',
    nativeName: '日本語',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Tokyo Standard (Hyojungo)',
        label: 'Tokyo Standard (Hyojungo)',
        promptHint: 'Speak in natural Tokyo Standard Japanese (Hyojungo) with accurate standard pitch accent and clean mora timing.',
      },
      {
        id: 'Kansai (Osaka / Kyoto)',
        label: 'Kansai (Osaka / Kyoto)',
        promptHint: 'Speak in unmistakable Kansai (Osaka/Kyoto) Japanese pitch accent: expressive low-start pitch rises, lively vowel elongation, and warm Kansai melody.',
      },
      {
        id: 'Calm Documentary Narration',
        label: 'Calm Documentary Narration',
        promptHint: 'Speak in measured, articulate Japanese documentary broadcast voiceover style.',
      },
    ],
  },
  {
    code: 'ko',
    label: 'Korean',
    nativeName: '한국어',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Seoul Standard (Pyojuneo)',
        label: 'Seoul Standard (Pyojuneo)',
        promptHint: 'Speak in natural Seoul Standard Korean (Pyojuneo) with smooth modern Seoul intonation.',
      },
      {
        id: 'Busan (Gyeongsang)',
        label: 'Busan (Gyeongsang)',
        promptHint: 'Speak Korean with an unmistakable Busan / Gyeongsang tonal accent: strong high-low pitch contrasts on initial syllables and punchy southeastern cadence.',
      },
      {
        id: 'Broadcast Anchor',
        label: 'Broadcast Anchor',
        promptHint: 'Speak in crisp, authoritative Korean newsroom broadcast articulation.',
      },
    ],
  },
  {
    code: 'zh',
    label: 'Mandarin Chinese',
    nativeName: '中文',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Mainland Standard (Putonghua)',
        label: 'Mainland Standard (Putonghua)',
        promptHint: 'Speak in crisp Mainland Standard Mandarin (Putonghua) with full retroflex zh/ch/sh, natural Beijing erhua clarity, and accurate four tones.',
      },
      {
        id: 'Taiwanese Mandarin (Taipei)',
        label: 'Taiwanese Mandarin (Taipei)',
        promptHint: 'Speak in unmistakable Taiwanese Mandarin (Taipei Guoyu): softer de-retroflexed z/c/s consonants, gentle floating phrase endings, and warm Taipei cadence.',
      },
      {
        id: 'Singaporean Mandarin',
        label: 'Singaporean Mandarin',
        promptHint: 'Speak in natural Singaporean Mandarin with even tonal transitions and brisk conversational pacing.',
      },
    ],
  },
  {
    code: 'ur',
    label: 'Urdu',
    nativeName: 'اردو',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Pakistani Standard (Karachi / Lahore)',
        label: 'Pakistani Standard (Karachi / Lahore)',
        promptHint: 'Speak in authentic Pakistani Urdu (Karachi/Lahore) with crisp uvular qaf/ghain consonants, grounded warm tone, and natural Pakistani phrasing.',
      },
      {
        id: 'Classic Literary (Lucknow)',
        label: 'Classic Literary (Lucknow)',
        promptHint: 'Speak in refined poetic Lucknow Urdu diction with deliberate classical cadence and crystal-clear consonant enunciation.',
      },
    ],
  },
  {
    code: 'tr',
    label: 'Turkish',
    nativeName: 'Türkçe',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Istanbul Standard',
        label: 'Istanbul Standard',
        promptHint: 'Speak in natural Istanbul Standard Turkish with smooth vowel harmony and crisp alveolar consonants.',
      },
      {
        id: 'Broadcast Formal',
        label: 'Broadcast Formal',
        promptHint: 'Speak in crisp, authoritative Turkish TRT newsroom broadcast style.',
      },
    ],
  },
  {
    code: 'it',
    label: 'Italian',
    nativeName: 'Italiano',
    forSynthesis: true,
    forCloning: true,
    accents: [
      {
        id: 'Standard Italian',
        label: 'Standard Italian',
        promptHint: 'Speak in crisp Standard Italian with clean geminate consonants and balanced melodic intonation.',
      },
      {
        id: 'Roman (Rome)',
        label: 'Roman (Rome)',
        promptHint: 'Speak in unmistakable Roman Italian (Roma): warm open vowels, lively Roman speech rhythm, and conversational cadence.',
      },
      {
        id: 'Southern Italian',
        label: 'Southern Italian',
        promptHint: 'Speak in unmistakable Southern Italian (Naples/Sicily): musical drawn vowels, strong rhythmic emphasis, and expressive Mediterranean storytelling.',
      },
    ],
  },
  {
    code: 'other',
    label: 'Other Global Language',
    forSynthesis: false,
    forCloning: true,
    accents: [
      {
        id: 'Native / Standard',
        label: 'Native / Standard',
        promptHint: 'Speak naturally with clear native pronunciation for the chosen language.',
      },
    ],
  },
];

export function getSynthesisLanguages(): VoiceLanguageOption[] {
  return VOICE_LANGUAGES.filter((l) => l.forSynthesis !== false);
}

export function getCloningLanguages(): VoiceLanguageOption[] {
  return VOICE_LANGUAGES.filter((l) => l.forCloning !== false);
}

export function getLanguageOption(code?: string): VoiceLanguageOption | undefined {
  if (!code) return undefined;
  const normalized = code.trim().toLowerCase();
  return VOICE_LANGUAGES.find((l) => l.code.toLowerCase() === normalized);
}

export function getLanguageLabel(code?: string): string {
  if (!code) return 'Auto-Detect';
  const opt = getLanguageOption(code);
  if (opt) {
    return opt.nativeName ? `${opt.label} (${opt.nativeName})` : opt.label;
  }
  return code;
}

export function getShortLanguageLabel(code?: string): string {
  if (!code) return 'Auto-Detect';
  if (code === 'auto') return 'Auto-Detect';
  if (code === 'multilingual') return 'Multilingual';
  const opt = getLanguageOption(code);
  return opt ? opt.label : code.toUpperCase();
}

export function getAccentsForLanguage(code?: string): VoiceAccentOption[] {
  const opt = getLanguageOption(code);
  if (opt && opt.accents.length > 0) return opt.accents;
  return VOICE_LANGUAGES[0].accents;
}

export function getDefaultAccentForLanguage(code?: string): string {
  const accents = getAccentsForLanguage(code);
  return accents[0]?.label || 'Native / Standard';
}

export function normalizeLanguageCode(raw?: string, fallback: string = 'auto'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return fallback;
  const direct = VOICE_LANGUAGES.find((l) => l.code.toLowerCase() === trimmed);
  if (direct) return direct.code;
  // Allow clean ISO-like codes (e.g. 'ru', 'nl', 'id') cleanly up to 24 chars
  const cleaned = trimmed.replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return cleaned || fallback;
}

export function resolveSelectionForVoiceProfile(voice?: {
  language?: string;
  accent?: string;
  isCustom?: boolean;
}): {
  language: string;
  accent: string;
  customAccent: string;
} {
  if (!voice) {
    return {
      language: 'auto',
      accent: getDefaultAccentForLanguage('auto'),
      customAccent: '',
    };
  }

  const rawLang = (voice.language || '').trim().toLowerCase();
  const mappedLang =
    !rawLang || rawLang === 'multilingual' || rawLang === 'other'
      ? 'auto'
      : getSynthesisLanguages().some((l) => l.code === rawLang)
      ? rawLang
      : 'auto';

  const accents = getAccentsForLanguage(mappedLang);
  const storedAccent = (voice.accent || '').trim();

  if (!storedAccent) {
    return {
      language: mappedLang,
      accent: accents[0]?.label || 'Native / Standard',
      customAccent: '',
    };
  }

  const matched = accents.find(
    (a) =>
      a.label.toLowerCase() === storedAccent.toLowerCase() ||
      a.id.toLowerCase() === storedAccent.toLowerCase()
  );

  if (matched) {
    return {
      language: mappedLang,
      accent: matched.label,
      customAccent: '',
    };
  }

  // If the stored accent is a generic placeholder from legacy defaults, keep standard option
  const lower = storedAccent.toLowerCase();
  if (
    lower === 'standard' ||
    lower === 'custom voice clone' ||
    lower === 'studio broadcast' ||
    lower === 'studio narrative'
  ) {
    return {
      language: mappedLang,
      accent: accents[0]?.label || 'Native / Standard',
      customAccent: '',
    };
  }

  return {
    language: mappedLang,
    accent: CUSTOM_ACCENT_ID,
    customAccent: storedAccent,
  };
}

export interface VoiceCloneAcousticProfile {
  detectedGender?: 'male' | 'female';
  pitchRegister?: string;
  vocalTimbre?: string;
  cadenceAndPacing?: string;
  accentCharacteristics?: string;
  recommendedBaseVoice?: string;
  voiceDesignDirective?: string;
}

const MALE_PREBUILT_VOICES = ['Charon', 'Fenrir', 'Puck'] as const;
const FEMALE_PREBUILT_VOICES = ['Kore', 'Aoede', 'Zephyr'] as const;

export function selectGenderLockedPrebuiltVoice(params: {
  requestedGender?: string;
  fingerprint?: VoiceCloneAcousticProfile | null;
  isCustom?: boolean;
}): {
  effectiveGender: 'male' | 'female';
  prebuiltVoiceName: string;
} {
  const rawGender = (params.requestedGender || '').toLowerCase();
  let effectiveGender: 'male' | 'female';

  if (rawGender === 'female') {
    effectiveGender = 'female';
  } else if (rawGender === 'male') {
    effectiveGender = 'male';
  } else {
    effectiveGender = params.fingerprint?.detectedGender === 'female' ? 'female' : 'male';
  }

  const candidate = params.fingerprint?.recommendedBaseVoice;
  if (effectiveGender === 'female') {
    const valid = FEMALE_PREBUILT_VOICES.find((v) => v === candidate);
    return {
      effectiveGender: 'female',
      prebuiltVoiceName: valid || (params.isCustom ? 'Aoede' : 'Kore'),
    };
  }

  const valid = MALE_PREBUILT_VOICES.find((v) => v === candidate);
  return {
    effectiveGender: 'male',
    prebuiltVoiceName: valid || 'Charon',
  };
}

const REGIONAL_VOICE_DESIGN_ACCENTS = new Set([
  'Irish',
  'Scottish',
  'Indian English',
  'West Bengal (Kolkata Standard)',
  'Sylheti-inflected Warm',
  'Chittagonian-inflected Neutral',
  'Classic Literary / Recitation',
  'Mumbai Conversational',
  'Lucknow Polite',
  'Egyptian (Cairo)',
  'Gulf (Khaleeji)',
  'Levantine (Beirut / Damascus)',
  'Moroccan (Maghrebi)',
  'Colombian (Bogota)',
  'Rioplatense (Argentina)',
  'Canadian (Quebecois)',
  'Southern French (Marseille)',
  'European (Lisbon)',
  'Northeastern Brazilian',
  'Austrian (Vienna)',
  'Swiss Standard German',
  'Bavarian-inflected Warm',
  'Kansai (Osaka / Kyoto)',
  'Busan (Gyeongsang)',
  'Taiwanese Mandarin (Taipei)',
  'Classic Literary (Lucknow)',
  'Roman (Rome)',
  'Southern Italian',
]);

export function getSpeechLanguageCode(langCode?: string, accentLabel?: string): string | undefined {
  const code = normalizeLanguageCode(langCode, 'auto');
  if (!code || code === 'auto' || code === 'multilingual' || code === 'other') {
    return undefined;
  }

  const acc = (accentLabel || '').toLowerCase();

  switch (code) {
    case 'en':
      if (acc.includes('british') || acc.includes('london') || acc.includes('scottish')) return 'en-GB';
      if (acc.includes('australian')) return 'en-AU';
      if (acc.includes('indian')) return 'en-IN';
      if (acc.includes('irish')) return 'en-IE';
      if (acc.includes('canadian')) return 'en-CA';
      return 'en-US';
    case 'bn':
      if (acc.includes('kolkata') || acc.includes('west bengal')) return 'bn-IN';
      return 'bn-BD';
    case 'hi':
      return 'hi-IN';
    case 'ar':
      if (acc.includes('egyptian') || acc.includes('cairo')) return 'ar-EG';
      if (acc.includes('gulf') || acc.includes('khaleeji')) return 'ar-SA';
      if (acc.includes('levantine') || acc.includes('beirut') || acc.includes('damascus')) return 'ar-LB';
      if (acc.includes('moroccan') || acc.includes('maghrebi')) return 'ar-MA';
      return 'ar-XA';
    case 'es':
      if (acc.includes('castilian') || acc.includes('spain') || acc.includes('madrid')) return 'es-ES';
      if (acc.includes('mexican')) return 'es-MX';
      if (acc.includes('colombian') || acc.includes('bogota')) return 'es-CO';
      if (acc.includes('rioplatense') || acc.includes('argentina')) return 'es-AR';
      return 'es-419';
    case 'fr':
      if (acc.includes('canadian') || acc.includes('quebecois')) return 'fr-CA';
      if (acc.includes('belgian') || acc.includes('swiss')) return 'fr-BE';
      return 'fr-FR';
    case 'pt':
      if (acc.includes('european') || acc.includes('lisbon')) return 'pt-PT';
      return 'pt-BR';
    case 'de':
      if (acc.includes('austrian') || acc.includes('vienna')) return 'de-AT';
      if (acc.includes('swiss')) return 'de-CH';
      return 'de-DE';
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    case 'zh':
      if (acc.includes('taiwan')) return 'zh-TW';
      if (acc.includes('singapore')) return 'zh-SG';
      return 'zh-CN';
    case 'ur':
      if (acc.includes('lucknow')) return 'ur-IN';
      return 'ur-PK';
    case 'tr':
      return 'tr-TR';
    case 'it':
      return 'it-IT';
    default:
      return code.length === 2 ? code : undefined;
  }
}

export function shouldPreferVoiceDesignModel(params: {
  isCustomClone: boolean;
  resolvedLanguage: string;
  resolvedAccent: string;
  isCustomAccent?: boolean;
}): boolean {
  if (params.isCustomClone || params.isCustomAccent) return true;
  if (REGIONAL_VOICE_DESIGN_ACCENTS.has(params.resolvedAccent)) return true;
  return false;
}

export function resolveVoiceoverStyleDirective(params: {
  language?: string;
  accent?: string;
  tone?: VoiceTone | string;
  speed?: number;
  pitch?: number;
  voiceName?: string;
  gender?: VoiceGender | string;
  scriptText?: string;
  customVoiceProfile?: {
    name: string;
    language?: string;
    accent?: string;
    description?: string;
    gender?: string;
  } | null;
  vocalFingerprint?: VoiceCloneAcousticProfile | null;
}): {
  resolvedLanguage: string;
  resolvedLanguageLabel: string;
  resolvedAccent: string;
  resolvedGender: 'male' | 'female';
  speechLanguageCode: string | undefined;
  isCustomAccent: boolean;
  styleDirective: string;
} {
  const requestedLang = normalizeLanguageCode(params.language, 'auto');
  const effectiveLangCode =
    requestedLang === 'auto' &&
    params.customVoiceProfile?.language &&
    params.customVoiceProfile.language !== 'multilingual' &&
    params.customVoiceProfile.language !== 'other'
      ? normalizeLanguageCode(params.customVoiceProfile.language, 'auto')
      : requestedLang;

  const langOpt = getLanguageOption(effectiveLangCode);
  const accents = getAccentsForLanguage(effectiveLangCode);

  const rawAccent = (params.accent || '').trim();
  const fallbackProfileAccent = (params.customVoiceProfile?.accent || '').trim();
  const chosenAccentRaw = rawAccent || fallbackProfileAccent;

  const matchedAccent = accents.find(
    (a) =>
      a.label.toLowerCase() === chosenAccentRaw.toLowerCase() ||
      a.id.toLowerCase() === chosenAccentRaw.toLowerCase()
  );

  const isCustomAccent = Boolean(
    !matchedAccent && chosenAccentRaw && chosenAccentRaw !== CUSTOM_ACCENT_ID
  );

  const resolvedAccent = matchedAccent
    ? matchedAccent.label
    : isCustomAccent
    ? chosenAccentRaw.slice(0, 80)
    : getDefaultAccentForLanguage(effectiveLangCode);

  const { effectiveGender } = selectGenderLockedPrebuiltVoice({
    requestedGender: params.customVoiceProfile?.gender || params.gender,
    fingerprint: params.vocalFingerprint,
    isCustom: Boolean(params.customVoiceProfile),
  });

  const speechLanguageCode = getSpeechLanguageCode(effectiveLangCode, resolvedAccent);

  const speakerIntro =
    effectiveGender === 'female'
      ? 'Adult female narrator (~185-235 Hz clear alto/soprano)'
      : 'Adult male narrator (~95-145 Hz grounded baritone/tenor chest voice)';

  const detectedScript = detectScriptCategory(params.scriptText);
  const nonLatinExpectedMap: Record<string, string> = {
    bn: 'bengali',
    hi: 'devanagari',
    ar: 'arabic',
    ur: 'arabic',
    ja: 'japanese',
    ko: 'korean',
    zh: 'cjk',
  };
  const expectedScript = nonLatinExpectedMap[effectiveLangCode];
  const isLatinScriptForNonLatinLanguage =
    Boolean(expectedScript) && detectedScript === 'latin';

  let accentCore: string;
  if (effectiveLangCode === 'auto' || effectiveLangCode === 'multilingual') {
    if (matchedAccent) {
      accentCore = matchedAccent.promptHint;
    } else if (resolvedAccent && resolvedAccent !== 'Native / Standard') {
      accentCore = `Detect script language automatically and speak with an unmistakable ${resolvedAccent} accent and regional cadence.`;
    } else {
      accentCore = 'Detect script language automatically with authentic native pronunciation.';
    }
  } else {
    const langName = langOpt?.label || effectiveLangCode.toUpperCase();
    const phoneticDetails = matchedAccent
      ? matchedAccent.promptHint
      : `Speak ${langName} with a distinct ${resolvedAccent} regional accent, local vowel coloring, and authentic cadence.`;
    accentCore = isLatinScriptForNonLatinLanguage
      ? `${phoneticDetails} Read the written words verbatim without translating them, pronounced in a strong native ${langName} (${resolvedAccent}) speaker accent.`
      : phoneticDetails;
  }

  let timbreNote = '';
  if (params.customVoiceProfile) {
    const fp = params.vocalFingerprint;
    const timbreParts = [
      fp?.pitchRegister || '',
      fp?.vocalTimbre || '',
      params.customVoiceProfile.description || '',
    ]
      .filter(Boolean)
      .slice(0, 2);
    if (timbreParts.length > 0) {
      timbreNote = `Timbre (${params.customVoiceProfile.name}): ${timbreParts.join(', ')}.`;
    }
  }

  const toneNote =
    params.tone === 'broadcast'
      ? 'Authoritative newsroom broadcast delivery'
      : params.tone === 'storytelling'
      ? 'Warm expressive storytelling delivery'
      : params.tone === 'energetic'
      ? 'Upbeat energetic promo delivery'
      : 'Natural conversational studio delivery';

  const speedVal = Number.isFinite(params.speed) ? params.speed : 1.0;
  const pitchVal = Number.isFinite(params.pitch) ? Number(params.pitch) : 0;
  const pitchNote =
    pitchVal >= 2 ? ', slightly brighter pitch' : pitchVal <= -2 ? ', slightly deeper pitch' : '';

  const styleDirective = [
    `${speakerIntro}.`,
    accentCore,
    timbreNote,
    `${toneNote}${pitchNote}, ${speedVal}x pace.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    resolvedLanguage: effectiveLangCode,
    resolvedLanguageLabel: getShortLanguageLabel(effectiveLangCode),
    resolvedAccent,
    resolvedGender: effectiveGender,
    speechLanguageCode,
    isCustomAccent,
    styleDirective,
  };
}
