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
        promptHint: 'Speak in the detected script language with crisp, balanced broadcast studio articulation.',
      },
      {
        id: 'Warm Storytelling',
        label: 'Warm Storytelling',
        promptHint: 'Speak in the detected script language with warm, expressive narrative phrasing.',
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
        promptHint: 'Adapt naturally to any target script language with clear studio pronunciation.',
      },
      {
        id: 'Neutral International',
        label: 'Neutral International',
        promptHint: 'Maintain clear, internationally intelligible pronunciation across languages.',
      },
      {
        id: 'Warm Narrative',
        label: 'Warm Narrative',
        promptHint: 'Expressive multilingual storytelling inflection with natural pauses.',
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
        promptHint: 'General American English pronunciation with natural rhotic vowels and conversational US cadence.',
      },
      {
        id: 'British (RP / London)',
        label: 'British (RP / London)',
        promptHint: 'Standard British English (Received Pronunciation / London) accent with crisp consonants and authentic British vowel inflection.',
      },
      {
        id: 'Australian',
        label: 'Australian',
        promptHint: 'Natural Australian English accent with relaxed Sydney/Melbourne vowel intonation and rhythm.',
      },
      {
        id: 'Indian English',
        label: 'Indian English',
        promptHint: 'Authentic Indian English accent with clear syllable-timed articulation and natural South Asian English prosody.',
      },
      {
        id: 'Irish',
        label: 'Irish',
        promptHint: 'Warm Irish English accent with melodic Dublin/Irish cadence and clear articulation.',
      },
      {
        id: 'Canadian',
        label: 'Canadian',
        promptHint: 'Natural Canadian English accent with clear North American broadcast phrasing.',
      },
      {
        id: 'Scottish',
        label: 'Scottish',
        promptHint: 'Clear Scottish English accent with gentle Edinburgh/Scottish rhythmic inflection.',
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
        promptHint: 'Standard Bangladeshi Bengali (Promito Dhaka Bangla) pronunciation, intonation, and natural conversational cadence.',
      },
      {
        id: 'West Bengal (Kolkata Standard)',
        label: 'West Bengal (Kolkata Standard)',
        promptHint: 'Standard West Bengal Bengali (Kolkata Bangla) articulation, vowel harmony, and expressive melodic cadence.',
      },
      {
        id: 'Sylheti-inflected Warm',
        label: 'Sylheti-inflected Warm',
        promptHint: 'Bengali narration with a subtle, warm Sylheti regional lilt while keeping words clearly intelligible.',
      },
      {
        id: 'Chittagonian-inflected Neutral',
        label: 'Chittagonian-inflected Neutral',
        promptHint: 'Bengali speech with a gentle southeastern Bangladeshi (Chattogram) rhythmic cadence and clear diction.',
      },
      {
        id: 'Classic Literary / Recitation',
        label: 'Classic Literary / Recitation',
        promptHint: 'Poetic, formal Bengali broadcast and recitation (abritti) style with crisp consonant clarity.',
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
        promptHint: 'Standard Delhi Hindi (Khari Boli) pronunciation with natural conversational cadence.',
      },
      {
        id: 'Mumbai Conversational',
        label: 'Mumbai Conversational',
        promptHint: 'Contemporary Mumbai Hindi delivery with relaxed urban phrasing and friendly warmth.',
      },
      {
        id: 'Lucknow Polite',
        label: 'Lucknow Polite',
        promptHint: 'Refined Lucknow Hindi diction with gentle polite intonation and crisp articulation.',
      },
      {
        id: 'Broadcast Formal',
        label: 'Broadcast Formal',
        promptHint: 'Crisp, formal Hindi news and documentary narration style.',
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
        promptHint: 'Clear Modern Standard Arabic (Al-Fusha) news and documentary pronunciation.',
      },
      {
        id: 'Egyptian (Cairo)',
        label: 'Egyptian (Cairo)',
        promptHint: 'Natural Egyptian Arabic (Masri / Cairo) cadence and warm conversational pronunciation.',
      },
      {
        id: 'Gulf (Khaleeji)',
        label: 'Gulf (Khaleeji)',
        promptHint: 'Authentic Gulf Arabic (Khaleeji) tone, vowel warmth, and regional cadence.',
      },
      {
        id: 'Levantine (Beirut / Damascus)',
        label: 'Levantine (Beirut / Damascus)',
        promptHint: 'Melodic Levantine Arabic pronunciation with smooth conversational flow.',
      },
      {
        id: 'Moroccan (Maghrebi)',
        label: 'Moroccan (Maghrebi)',
        promptHint: 'Authentic Maghrebi / Moroccan Arabic rhythmic inflection.',
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
        promptHint: 'Clear, neutral Latin American Spanish broadcast pronunciation.',
      },
      {
        id: 'Mexican',
        label: 'Mexican',
        promptHint: 'Natural Mexican Spanish (Ciudad de Mexico) cadence and warm intonation.',
      },
      {
        id: 'Castilian (Spain / Madrid)',
        label: 'Castilian (Spain / Madrid)',
        promptHint: 'Authentic European Castilian Spanish accent with crisp Madrid articulation.',
      },
      {
        id: 'Colombian (Bogota)',
        label: 'Colombian (Bogota)',
        promptHint: 'Clear, melodic Colombian (Bogota) Spanish cadence.',
      },
      {
        id: 'Rioplatense (Argentina)',
        label: 'Rioplatense (Argentina)',
        promptHint: 'Expressive Rioplatense (Buenos Aires) Spanish intonation with characteristic cadence.',
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
        promptHint: 'Standard Parisian Metropolitan French pronunciation with smooth liaison and phrasing.',
      },
      {
        id: 'Canadian (Quebecois)',
        label: 'Canadian (Quebecois)',
        promptHint: 'Natural Quebec French accent with authentic Canadian French vowel coloring.',
      },
      {
        id: 'Southern French (Marseille)',
        label: 'Southern French (Marseille)',
        promptHint: 'Warm Southern French accent with open vowels and expressive cadence.',
      },
      {
        id: 'Belgian / Swiss Neutral',
        label: 'Belgian / Swiss Neutral',
        promptHint: 'Clear, measured Belgian/Swiss French studio articulation.',
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
        promptHint: 'Natural Brazilian Portuguese pronunciation with open melodic vowels and smooth rhythm.',
      },
      {
        id: 'European (Lisbon)',
        label: 'European (Lisbon)',
        promptHint: 'Authentic European Portuguese (Lisbon) articulation and crisp consonant cadence.',
      },
      {
        id: 'Northeastern Brazilian',
        label: 'Northeastern Brazilian',
        promptHint: 'Warm Northeastern Brazilian Portuguese lilt and expressive storytelling rhythm.',
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
        promptHint: 'Standard High German (Hochdeutsch) broadcast pronunciation with crisp articulation.',
      },
      {
        id: 'Austrian (Vienna)',
        label: 'Austrian (Vienna)',
        promptHint: 'Warm Austrian German melodic intonation and refined Viennese phrasing.',
      },
      {
        id: 'Swiss Standard German',
        label: 'Swiss Standard German',
        promptHint: 'Measured, clear Swiss High German cadence.',
      },
      {
        id: 'Bavarian-inflected Warm',
        label: 'Bavarian-inflected Warm',
        promptHint: 'Friendly Southern German / Bavarian-tinted standard pronunciation.',
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
        promptHint: 'Natural Tokyo Standard Japanese pitch accent and clean studio phrasing.',
      },
      {
        id: 'Kansai (Osaka / Kyoto)',
        label: 'Kansai (Osaka / Kyoto)',
        promptHint: 'Warm Kansai-ben Japanese intonation with expressive Osaka/Kyoto pitch movement.',
      },
      {
        id: 'Calm Documentary Narration',
        label: 'Calm Documentary Narration',
        promptHint: 'Measured, articulate Japanese documentary voiceover pacing.',
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
        promptHint: 'Natural Seoul Standard Korean pronunciation and modern conversational cadence.',
      },
      {
        id: 'Busan (Gyeongsang)',
        label: 'Busan (Gyeongsang)',
        promptHint: 'Lively Busan / southeastern Korean tonal inflection.',
      },
      {
        id: 'Broadcast Anchor',
        label: 'Broadcast Anchor',
        promptHint: 'Crisp, authoritative Korean newsroom and narration phrasing.',
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
        promptHint: 'Standard Mainland Mandarin (Putonghua) with accurate four-tone contour and Beijing clarity.',
      },
      {
        id: 'Taiwanese Mandarin (Taipei)',
        label: 'Taiwanese Mandarin (Taipei)',
        promptHint: 'Soft, warm Taiwanese Mandarin (Guoyu) phrasing and gentle tone endings.',
      },
      {
        id: 'Singaporean Mandarin',
        label: 'Singaporean Mandarin',
        promptHint: 'Clear Singaporean Mandarin cadence with balanced conversational pacing.',
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
        promptHint: 'Natural Pakistani Urdu (Karachi/Lahore) pronunciation and warm expressive flow.',
      },
      {
        id: 'Classic Literary (Lucknow)',
        label: 'Classic Literary (Lucknow)',
        promptHint: 'Refined literary Urdu diction with poetic cadence and crisp consonant clarity.',
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
        promptHint: 'Standard Istanbul Turkish pronunciation with smooth vowel harmony and natural pacing.',
      },
      {
        id: 'Broadcast Formal',
        label: 'Broadcast Formal',
        promptHint: 'Crisp, authoritative Turkish news and documentary studio articulation.',
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
        promptHint: 'Standard Italian broadcast pronunciation with balanced intonation and crisp consonants.',
      },
      {
        id: 'Roman (Rome)',
        label: 'Roman (Rome)',
        promptHint: 'Warm Roman Italian conversational cadence.',
      },
      {
        id: 'Southern Italian',
        label: 'Southern Italian',
        promptHint: 'Expressive, melodic Southern Italian storytelling rhythm.',
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

export function resolveVoiceoverStyleDirective(params: {
  language?: string;
  accent?: string;
  tone?: VoiceTone | string;
  speed?: number;
  voiceName?: string;
  gender?: VoiceGender | string;
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

  const resolvedAccent = matchedAccent
    ? matchedAccent.label
    : chosenAccentRaw && chosenAccentRaw !== CUSTOM_ACCENT_ID
    ? chosenAccentRaw.slice(0, 80)
    : getDefaultAccentForLanguage(effectiveLangCode);

  const { effectiveGender } = selectGenderLockedPrebuiltVoice({
    requestedGender: params.customVoiceProfile?.gender || params.gender,
    fingerprint: params.vocalFingerprint,
    isCustom: Boolean(params.customVoiceProfile),
  });

  const genderDirective =
    effectiveGender === 'female'
      ? 'STRICT SPEAKER GENDER: Adult Female voice ONLY (natural female vocal cords, clear alto/soprano pitch ~185-235 Hz; never switch to a male register).'
      : 'STRICT SPEAKER GENDER: Adult Male voice ONLY (natural adult male chest-voice register, grounded baritone/tenor pitch ~95-145 Hz; never switch to a female or high-pitched register).';

  const toneInstruction =
    params.tone === 'broadcast'
      ? 'Delivery Tone: Professional authoritative news and documentary broadcast style.'
      : params.tone === 'storytelling'
      ? 'Delivery Tone: Warm, expressive narrative cadence with natural pauses.'
      : params.tone === 'energetic'
      ? 'Delivery Tone: Upbeat, confident, energetic promotional delivery.'
      : 'Delivery Tone: Natural, conversational, clear human speaking style.';

  let languageInstruction: string;
  if (effectiveLangCode === 'auto' || effectiveLangCode === 'multilingual') {
    const accentNote = matchedAccent
      ? matchedAccent.promptHint
      : resolvedAccent && resolvedAccent !== 'Native / Standard'
      ? `Apply ${resolvedAccent} regional pronunciation, intonation, and cadence.`
      : 'Speak fluently with authentic native pronunciation and natural cadence.';
    languageInstruction = `Language: Auto-detect the language from the script text (all global languages supported). ${accentNote}`;
  } else {
    const langDisplay = langOpt
      ? langOpt.nativeName
        ? `${langOpt.label} (${langOpt.nativeName})`
        : langOpt.label
      : effectiveLangCode.toUpperCase();
    const accentHint = matchedAccent
      ? matchedAccent.promptHint
      : `Speak with an authentic ${resolvedAccent} regional accent, vowel inflection, and local cadence.`;
    languageInstruction = `Primary Language: ${langDisplay}. Regional Accent: ${resolvedAccent}. ${accentHint}`;
  }

  let personaInstruction: string;
  if (params.customVoiceProfile) {
    const fp = params.vocalFingerprint;
    const acousticParts = [
      fp?.voiceDesignDirective,
      fp?.pitchRegister ? `Vocal Register: ${fp.pitchRegister}` : '',
      fp?.vocalTimbre ? `Timbre & Texture: ${fp.vocalTimbre}` : '',
      fp?.cadenceAndPacing ? `Cadence: ${fp.cadenceAndPacing}` : '',
      params.customVoiceProfile.description
        ? `User Notes: ${params.customVoiceProfile.description}`
        : '',
    ].filter(Boolean);

    personaInstruction =
      acousticParts.length > 0
        ? `Cloned Voice Design Profile ("${params.customVoiceProfile.name}"): ${acousticParts.join('. ')}.`
        : `Voice Persona: Adult ${effectiveGender} narrator matching "${params.customVoiceProfile.name}".`;
  } else {
    personaInstruction = `Voice Character: ${
      params.voiceName || (effectiveGender === 'female' ? 'Fatima (Female Studio)' : 'Kabir (Male Studio)')
    }.`;
  }

  const speedVal = Number.isFinite(params.speed) ? params.speed : 1.0;

  return {
    resolvedLanguage: effectiveLangCode,
    resolvedLanguageLabel: getShortLanguageLabel(effectiveLangCode),
    resolvedAccent,
    resolvedGender: effectiveGender,
    styleDirective: `${genderDirective} ${personaInstruction} ${toneInstruction} ${languageInstruction} Speaking Speed: ${speedVal}x.`,
  };
}
