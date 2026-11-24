import { VoiceGender, VoiceTone } from '../types';

export const CUSTOM_ACCENT_ID = '__custom__';

export type MoonshineArchKey =
  | 'tiny'
  | 'base'
  | 'tiny_streaming'
  | 'small_streaming'
  | 'medium_streaming';

export interface VoiceAccentOption {
  id: string;
  label: string;
  moonshineLang?: string;
  voiceFemaleOverride?: string;
  voiceMaleOverride?: string;
}

export interface VoiceLanguageOption {
  code: string;
  label: string;
  nativeName?: string;
  forSynthesis?: boolean;
  forCloning?: boolean;
  forStt?: boolean;
  sttSupported?: boolean;
  ttsSupported?: boolean;
  defaultSttArch?: MoonshineArchKey;
  availableSttArches?: MoonshineArchKey[];
  sttModelLabel?: string;
  ttsFemaleVoiceId?: string;
  ttsMaleVoiceId?: string;
  accents: VoiceAccentOption[];
}

export const MOONSHINE_LANGUAGE_CODES = [
  'en',
  'es',
  'de',
  'ja',
  'ar',
  'zh',
  'vi',
  'tl',
  'ko',
  'uk',
] as const;

export const SAMPLE_SCRIPTS_BY_LANGUAGE: Record<string, string> = {
  en: 'Welcome to Scriby Voiceover Studio. This speech sample runs locally in your browser using Moonshine WebAssembly for clear pacing and natural voice cloning.',
  es: 'Bienvenidos a Scriby Studio. Esta grabacion se sintetiza directamente en tu navegador con Moonshine WebAssembly.',
  de: 'Willkommen im Scriby Studio. Diese Sprachaufnahme wird lokal in Ihrem Browser mit Moonshine WebAssembly erzeugt.',
  ja: 'スクリビスタジオへようこそ。この音声はブラウザ上のムーンシャインでローカル生成されています。',
  ar: 'مرحبا بكم في استوديو سكرايبي. يتم توليد هذا الصوت محليا داخل المتصفح عبر تقنية ويب أسمبلي.',
  zh: '欢迎来到 Scriby 工作室。这段语音正在浏览器本地通过 Moonshine WebAssembly 引擎直接合成。',
  vi: 'Chao mung den voi Scriby Studio. Giong noi nay duoc tong hop truc tiep trong trinh duyet bang Moonshine WebAssembly.',
  tl: 'Maligayang pagdating sa Scriby Studio. Gumagamit ang sistemang ito ng lokal na Moonshine WebAssembly sa iyong browser.',
  ko: '스크라이비 스튜디오에 오신 것을 환영합니다. 이 음성은 브라우저 내 문샤인 웹어셈블리로 생성됩니다.',
  uk: 'Ласкаво просимо до студії Scriby. Цей голос синтезується локально у вашому браузері через Moonshine WebAssembly.',
};

export function detectScriptCategory(
  text?: string
): 'arabic' | 'japanese' | 'korean' | 'cjk' | 'cyrillic' | 'latin' | 'unknown' {
  if (!text || !text.trim()) return 'unknown';
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  if (/[\u3040-\u30FF]/.test(text)) return 'japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'cjk';
  if (/[\u0400-\u04FF]/.test(text)) return 'cyrillic';
  if (/[A-Za-z]/.test(text)) return 'latin';
  return 'unknown';
}

export function resolveMoonshineLanguageFromText(text?: string, requestedLang?: string): string {
  const normalized = normalizeLanguageCode(requestedLang, 'auto');
  if (normalized !== 'auto' && normalized !== 'multilingual') {
    return normalized;
  }
  const cat = detectScriptCategory(text);
  switch (cat) {
    case 'arabic':
      return 'ar';
    case 'japanese':
      return 'ja';
    case 'korean':
      return 'ko';
    case 'cjk':
      return 'zh';
    case 'cyrillic':
      return 'uk';
    default:
      return 'en';
  }
}

export const VOICE_LANGUAGES: VoiceLanguageOption[] = [
  {
    code: 'auto',
    label: 'Auto-Detect from Script',
    forSynthesis: true,
    forCloning: false,
    forStt: false,
    sttSupported: false,
    ttsSupported: true,
    accents: [
      {
        id: 'Native / Standard',
        label: 'Native / Standard',
      },
      {
        id: 'Studio Broadcast',
        label: 'Studio Broadcast',
      },
    ],
  },
  {
    code: 'en',
    label: 'English',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'medium_streaming',
    availableSttArches: ['medium_streaming', 'small_streaming', 'tiny_streaming', 'base', 'tiny'],
    sttModelLabel: 'Medium Streaming',
    ttsFemaleVoiceId: 'kokoro_af_heart',
    ttsMaleVoiceId: 'kokoro_am_adam',
    accents: [
      {
        id: 'American (General US)',
        label: 'American (General US)',
        moonshineLang: 'en_us',
        voiceFemaleOverride: 'kokoro_af_heart',
        voiceMaleOverride: 'kokoro_am_adam',
      },
      {
        id: 'British (RP / London)',
        label: 'British (RP / London)',
        moonshineLang: 'en_gb',
        voiceFemaleOverride: 'kokoro_bf_emma',
        voiceMaleOverride: 'kokoro_bm_george',
      },
      {
        id: 'Studio Clear (Bella / Michael)',
        label: 'Studio Clear (Bella / Michael)',
        moonshineLang: 'en_us',
        voiceFemaleOverride: 'kokoro_af_bella',
        voiceMaleOverride: 'kokoro_am_michael',
      },
    ],
  },
  {
    code: 'es',
    label: 'Spanish',
    nativeName: 'Español',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'base',
    availableSttArches: ['base'],
    sttModelLabel: 'Base',
    ttsFemaleVoiceId: 'kokoro_ef_dora',
    ttsMaleVoiceId: 'kokoro_em_alex',
    accents: [
      {
        id: 'Castilian / Neutral (Dora / Alex)',
        label: 'Castilian / Neutral (Dora / Alex)',
        moonshineLang: 'es',
        voiceFemaleOverride: 'kokoro_ef_dora',
        voiceMaleOverride: 'kokoro_em_alex',
      },
      {
        id: 'Latin American (Mexico)',
        label: 'Latin American (Mexico)',
        moonshineLang: 'es',
        voiceFemaleOverride: 'piper_es_MX-claude-high',
        voiceMaleOverride: 'piper_es_MX-ald-medium',
      },
    ],
  },
  {
    code: 'de',
    label: 'German',
    nativeName: 'Deutsch',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: false, // Pending WASM STT manifest in moonshine-wasm@0.1.6 (TTS supported)
    ttsSupported: true,
    sttModelLabel: 'TTS Ready (STT pending)',
    ttsFemaleVoiceId: 'piper_de_DE-kerstin-low',
    ttsMaleVoiceId: 'piper_de_DE-thorsten-high',
    accents: [
      {
        id: 'Standard German (Hochdeutsch)',
        label: 'Standard German (Hochdeutsch)',
        moonshineLang: 'de',
        voiceFemaleOverride: 'piper_de_DE-kerstin-low',
        voiceMaleOverride: 'piper_de_DE-thorsten-high',
      },
      {
        id: 'Expressive Studio (Thorsten / Eva)',
        label: 'Expressive Studio (Thorsten / Eva)',
        moonshineLang: 'de',
        voiceFemaleOverride: 'piper_de_DE-eva_k-x_low',
        voiceMaleOverride: 'piper_de_DE-thorsten_emotional-medium',
      },
    ],
  },
  {
    code: 'ja',
    label: 'Japanese',
    nativeName: '日本語',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'base',
    availableSttArches: ['base', 'tiny'],
    sttModelLabel: 'Base',
    ttsFemaleVoiceId: 'kokoro_jf_alpha',
    ttsMaleVoiceId: 'kokoro_jm_kumo',
    accents: [
      {
        id: 'Tokyo Standard (Hyojungo)',
        label: 'Tokyo Standard (Hyojungo)',
        moonshineLang: 'ja',
        voiceFemaleOverride: 'kokoro_jf_alpha',
        voiceMaleOverride: 'kokoro_jm_kumo',
      },
      {
        id: 'Soft Narrative (Gongitsune)',
        label: 'Soft Narrative (Gongitsune)',
        moonshineLang: 'ja',
        voiceFemaleOverride: 'kokoro_jf_gongitsune',
        voiceMaleOverride: 'kokoro_jm_kumo',
      },
    ],
  },
  {
    code: 'ar',
    label: 'Arabic',
    nativeName: 'العربية',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'base',
    availableSttArches: ['base'],
    sttModelLabel: 'Base',
    ttsFemaleVoiceId: 'piper_ar_JO-kareem-medium',
    ttsMaleVoiceId: 'piper_ar_JO-kareem-medium',
    accents: [
      {
        id: 'Modern Standard Arabic (Fusha)',
        label: 'Modern Standard Arabic (Fusha)',
        moonshineLang: 'ar',
        voiceFemaleOverride: 'piper_ar_JO-kareem-medium',
        voiceMaleOverride: 'piper_ar_JO-kareem-medium',
      },
    ],
  },
  {
    code: 'zh',
    label: 'Mandarin Chinese',
    nativeName: '中文',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'base',
    availableSttArches: ['base'],
    sttModelLabel: 'Base',
    ttsFemaleVoiceId: 'kokoro_zf_xiaoxiao',
    ttsMaleVoiceId: 'kokoro_zm_yunjian',
    accents: [
      {
        id: 'Mainland Standard (Putonghua)',
        label: 'Mainland Standard (Putonghua)',
        moonshineLang: 'zh',
        voiceFemaleOverride: 'kokoro_zf_xiaoxiao',
        voiceMaleOverride: 'kokoro_zm_yunjian',
      },
      {
        id: 'Studio Clear (Xiaoyi / Yunxi)',
        label: 'Studio Clear (Xiaoyi / Yunxi)',
        moonshineLang: 'zh',
        voiceFemaleOverride: 'kokoro_zf_xiaoyi',
        voiceMaleOverride: 'kokoro_zm_yunxi',
      },
    ],
  },
  {
    code: 'vi',
    label: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'base',
    availableSttArches: ['base'],
    sttModelLabel: 'Base',
    ttsFemaleVoiceId: 'piper_vi_VN-vivos-x_low',
    ttsMaleVoiceId: 'piper_vi_VN-vais1000-medium',
    accents: [
      {
        id: 'Standard Vietnamese',
        label: 'Standard Vietnamese',
        moonshineLang: 'vi',
        voiceFemaleOverride: 'piper_vi_VN-vivos-x_low',
        voiceMaleOverride: 'piper_vi_VN-vais1000-medium',
      },
    ],
  },
  {
    code: 'tl',
    label: 'Tagalog',
    nativeName: 'Tagalog / Filipino',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: false, // Pending WASM manifest in moonshine-wasm@0.1.6
    ttsSupported: false,
    sttModelLabel: 'WASM Pack Pending',
    accents: [
      {
        id: 'Standard Tagalog',
        label: 'Standard Tagalog',
      },
    ],
  },
  {
    code: 'ko',
    label: 'Korean',
    nativeName: '한국어',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'tiny',
    availableSttArches: ['tiny'],
    sttModelLabel: 'Tiny',
    ttsFemaleVoiceId: 'piper_ko_KR-melotts-medium',
    ttsMaleVoiceId: 'piper_ko_KR-melotts-medium',
    accents: [
      {
        id: 'Seoul Standard (Pyojuneo)',
        label: 'Seoul Standard (Pyojuneo)',
        moonshineLang: 'ko',
        voiceFemaleOverride: 'piper_ko_KR-melotts-medium',
        voiceMaleOverride: 'piper_ko_KR-melotts-medium',
      },
    ],
  },
  {
    code: 'uk',
    label: 'Ukrainian',
    nativeName: 'Українська',
    forSynthesis: true,
    forCloning: true,
    forStt: true,
    sttSupported: true,
    ttsSupported: true,
    defaultSttArch: 'base',
    availableSttArches: ['base'],
    sttModelLabel: 'Base',
    ttsFemaleVoiceId: 'piper_uk_UA-lada-x_low',
    ttsMaleVoiceId: 'piper_uk_UA-ukrainian_tts-medium',
    accents: [
      {
        id: 'Standard Ukrainian',
        label: 'Standard Ukrainian',
        moonshineLang: 'uk',
        voiceFemaleOverride: 'piper_uk_UA-lada-x_low',
        voiceMaleOverride: 'piper_uk_UA-ukrainian_tts-medium',
      },
    ],
  },
];

export function getSttLanguages(): VoiceLanguageOption[] {
  return VOICE_LANGUAGES.filter((l) => l.forStt === true);
}

export function getSynthesisLanguages(): VoiceLanguageOption[] {
  return VOICE_LANGUAGES.filter((l) => l.forSynthesis !== false);
}

export function getCloningLanguages(): VoiceLanguageOption[] {
  return VOICE_LANGUAGES.filter((l) => l.forCloning !== false);
}

export function getLanguageOption(code?: string): VoiceLanguageOption | undefined {
  if (!code) return undefined;
  const normalized = code.trim().toLowerCase();
  if (normalized === 'en_us' || normalized === 'en_gb') {
    return VOICE_LANGUAGES.find((l) => l.code === 'en');
  }
  if (normalized === 'zh_hans') {
    return VOICE_LANGUAGES.find((l) => l.code === 'zh');
  }
  return VOICE_LANGUAGES.find((l) => l.code.toLowerCase() === normalized);
}

export function getLanguageLabel(code?: string): string {
  if (!code || code === 'auto') return 'Auto-Detect';
  if (code === 'multilingual') return 'Moonshine Multi-Language';
  const opt = getLanguageOption(code);
  if (opt) {
    return opt.nativeName ? `${opt.label} (${opt.nativeName})` : opt.label;
  }
  return code;
}

export function getShortLanguageLabel(code?: string): string {
  if (!code) return 'Auto-Detect';
  if (code === 'auto') return 'Auto-Detect';
  if (code === 'multilingual') return 'English';
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

export function normalizeLanguageCode(raw?: string, fallback: string = 'en'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'multilingual' || trimmed === 'other') return fallback;
  if (trimmed === 'en_us' || trimmed === 'en_gb') return 'en';
  if (trimmed === 'zh_hans') return 'zh';
  const direct = VOICE_LANGUAGES.find((l) => l.code.toLowerCase() === trimmed);
  if (direct) return direct.code;
  return fallback;
}

export function resolveMoonshineVoiceSelection(params: {
  language?: string;
  accent?: string;
  gender?: VoiceGender | string;
  scriptText?: string;
}): {
  resolvedLanguage: string;
  moonshineLanguage: string;
  voiceId: string;
  accentLabel: string;
} {
  const resolvedLang = resolveMoonshineLanguageFromText(params.scriptText, params.language);
  const safeLang =
    resolvedLang === 'tl' || !getLanguageOption(resolvedLang)?.ttsSupported
      ? 'en'
      : resolvedLang;
  const opt = getLanguageOption(safeLang) || getLanguageOption('en')!;
  const accents = opt.accents;
  const chosenAccent = (params.accent || '').trim().toLowerCase();
  const matchedAccent = accents.find(
    (a) => a.label.toLowerCase() === chosenAccent || a.id.toLowerCase() === chosenAccent
  );

  const isFemale = String(params.gender || '').toLowerCase() === 'female';
  const voiceId = isFemale
    ? matchedAccent?.voiceFemaleOverride || opt.ttsFemaleVoiceId || 'kokoro_af_heart'
    : matchedAccent?.voiceMaleOverride || opt.ttsMaleVoiceId || 'kokoro_am_adam';

  return {
    resolvedLanguage: safeLang,
    moonshineLanguage: matchedAccent?.moonshineLang || safeLang,
    voiceId,
    accentLabel: matchedAccent?.label || accents[0]?.label || 'Native / Standard',
  };
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
      language: 'en',
      accent: getDefaultAccentForLanguage('en'),
      customAccent: '',
    };
  }

  const rawLang = (voice.language || '').trim().toLowerCase();
  const mappedLang =
    !rawLang || rawLang === 'multilingual' || rawLang === 'other' || rawLang === 'auto'
      ? 'en'
      : getSynthesisLanguages().some((l) => l.code === rawLang && l.ttsSupported)
      ? rawLang
      : 'en';

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

  const lower = storedAccent.toLowerCase();
  if (
    lower === 'standard' ||
    lower === 'custom voice clone' ||
    lower === 'studio broadcast' ||
    lower === 'studio narrative' ||
    lower === 'zero-shot clone'
  ) {
    return {
      language: mappedLang,
      accent: accents[0]?.label || 'Native / Standard',
      customAccent: '',
    };
  }

  return {
    language: mappedLang,
    accent: accents[0]?.label || 'Native / Standard',
    customAccent: '',
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
  engine?: string;
}

export function buildLocalVoiceCloneProfile(params: {
  gender?: string;
  language?: string;
  durationSeconds?: number;
  voiceName?: string;
}): VoiceCloneAcousticProfile {
  const g: 'male' | 'female' =
    String(params.gender || '').toLowerCase() === 'female' ? 'female' : 'male';
  const langLabel = getShortLanguageLabel(params.language || 'en');
  return {
    detectedGender: g,
    pitchRegister: g === 'female' ? 'Clear studio voice sample' : 'Grounded studio voice sample',
    vocalTimbre: `Moonshine ZipVoice zero-shot profile (${langLabel})`,
    cadenceAndPacing: `${Math.max(1, Math.round(params.durationSeconds || 10))}s reference clip cached locally`,
    recommendedBaseVoice: g === 'female' ? 'zipvoice_american_female' : 'zipvoice_american_male',
    voiceDesignDirective: `Zero-shot reference audio for "${params.voiceName || 'Custom Voice'}"`,
    engine: 'moonshine-wasm-zipvoice',
  };
}
