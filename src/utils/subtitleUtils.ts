import { TranscriptSegment } from '../types';

export interface StructuredSubtitleCue {
  id: string;
  index: number;
  start: number;
  end: number;
  speaker: string;
  text: string;
  hasTimestamp: boolean;
}

const NON_SPEAKER_PREFIXES = new Set([
  'http',
  'https',
  'ftp',
  'note',
  'notes',
  'tip',
  'warning',
  'summary',
  'caption',
  'subtitles',
  'example',
]);

/**
 * Parses SRT/VTT/player timestamps like "00:01:02,500", "01:02.500", or "00:05" into seconds.
 */
export function parseTimestampToSeconds(raw: string): number | null {
  const clean = (raw || '').trim().replace(',', '.');
  const match = clean.match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = match[4] ? Number(match[4].padEnd(3, '0')) / 1000 : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return Number((hours * 3600 + minutes * 60 + seconds + millis).toFixed(3));
}

function normalizeSpeakerName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const speakerNumMatch = cleaned.match(/^speaker\s*[-_#]?\s*(\d+)$/i);
  if (speakerNumMatch) {
    return `Speaker ${speakerNumMatch[1]}`;
  }
  return cleaned;
}

/**
 * Strips ASS/SSA override tags, HTML subtitle markup, non-spoken stage cues,
 * timestamps, and unsupported control symbols while preserving natural speech.
 */
export function sanitizeSubtitleCueText(raw: string): string {
  if (!raw) return '';
  let text = String(raw)
    .replace(/\uFEFF/g, '')
    // ASS/SSA styling blocks e.g. {\an8}, {\b1}
    .replace(/\{\\[^}]+\}/g, ' ')
    // HTML subtitle tags e.g. <i>, </i>, <font color="...">
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    // Platform non-speech placeholder lines
    .replace(/\(\s*no spoken words detected[^)]*\)/gi, ' ')
    // Inline timecodes e.g. [00:01], [00:01 - 00:05]
    .replace(/\[\s*\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?(?:\s*[-–—]\s*\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?)?\s*\]/g, ' ')
    // Bracketed SFX / stage directions e.g. [Music], [Applause], (Laughter)
    .replace(/\[\s*(?:music|applause|laughter|cheering|silence|noise|sfx|sound effect|inaudible|crosstalk|singing|instr(?:umental)?)\s*\]/gi, ' ')
    .replace(/\(\s*(?:music|applause|laughter|cheering|silence|noise|sfx|sound effect|inaudible|crosstalk|singing|instr(?:umental)?)\s*\)/gi, ' ')
    // Musical notes & control characters
    .replace(/[♪♫♬♩\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    // Leading SRT dialogue hyphen when single line
    .replace(/^\s*[-–—]+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If the entire text is just punctuation/brackets with no letters or digits, return empty
  if (!/[\p{L}\p{N}]/u.test(text)) {
    return '';
  }

  return text;
}

export function hasSpeakableText(text?: string): boolean {
  return sanitizeSubtitleCueText(text || '').length > 0;
}

function extractSpeakerPrefixFromText(rawText: string): { speaker?: string; text: string } {
  const rawTrimmed = (rawText || '').trim();
  if (!rawTrimmed) return { text: '' };

  // 1. VTT voice tag: <v Speaker 2>Hello there</v> or <v Roger>Hello
  const vttVoiceMatch = rawTrimmed.match(/^(?:\{\\[^}]+\}\s*)*<v\s+([^>]{1,36})>\s*([\s\S]*)$/i);
  if (vttVoiceMatch) {
    const speaker = normalizeSpeakerName(vttVoiceMatch[1]);
    const body = sanitizeSubtitleCueText(vttVoiceMatch[2].replace(/<\/v>/gi, ''));
    return { speaker, text: body };
  }

  // Strip ASS override blocks and HTML styling markup (like <i>, <font>) before checking speaker prefixes
  const text = rawTrimmed
    .replace(/\uFEFF/g, '')
    .replace(/\{\\[^}]+\}/g, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/\[\s*\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?(?:\s*[-–—]\s*\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?)?\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return { text: '' };

  // 2. Bracketed speaker tag: "[Speaker 1]: Hello" or "[Male] Hello"
  const bracketMatch = text.match(/^\[([^\]]{1,32})\]\s*:?\s+([\s\S]+)$/);
  if (
    bracketMatch &&
    !/^\d{1,2}:\d{2}/.test(bracketMatch[1]) &&
    !/^(?:music|applause|laughter|cheering|silence|noise|sfx|sound effect|inaudible|crosstalk|singing|instr(?:umental)?)$/i.test(bracketMatch[1].trim())
  ) {
    return {
      speaker: normalizeSpeakerName(bracketMatch[1]),
      text: sanitizeSubtitleCueText(bracketMatch[2]),
    };
  }

  // 3. Explicit colon speaker tag: "Speaker 1: Hello", "Male: Hello", "Female: Hello", "Host: Hello"
  const colonMatch = text.match(/^([A-Za-z][A-Za-z0-9 _.-]{0,28})\s*:\s+([\s\S]+)$/);
  if (colonMatch) {
    const candidate = colonMatch[1].trim();
    const wordCount = candidate.split(/\s+/).length;
    if (
      wordCount <= 3 &&
      !NON_SPEAKER_PREFIXES.has(candidate.toLowerCase()) &&
      !/^https?$/i.test(candidate)
    ) {
      return {
        speaker: normalizeSpeakerName(candidate),
        text: sanitizeSubtitleCueText(colonMatch[2]),
      };
    }
  }

  return {
    text: sanitizeSubtitleCueText(text),
  };
}

/**
 * Parses external subtitle files (.srt, .vtt, .json, .txt) into structured timeline cues,
 * preserving start/end timestamps and speaker labels (e.g. Speaker 1, Speaker 2, Male, Female).
 */
export function parseSubtitleToCues(content: string): StructuredSubtitleCue[] {
  if (!content || !content.trim()) return [];

  // 1. JSON format (e.g., Scriby JSON export)
  try {
    const parsed = JSON.parse(content);
    const segArray = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.segments)
      ? parsed.segments
      : null;

    if (segArray && segArray.length > 0) {
      return convertSegmentsToCues(segArray);
    }
  } catch {}

  // 2. SRT / VTT / TXT stateful line-by-line parser (works both with and without blank separator lines)
  const lines = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: StructuredSubtitleCue[] = [];

  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  let currentTextLines: string[] = [];

  const flushTimedCue = () => {
    if (currentStart === null || currentEnd === null) return;
    const rawJoined = currentTextLines.join(' ').replace(/\s+/g, ' ').trim();
    if (rawJoined) {
      const extracted = extractSpeakerPrefixFromText(rawJoined);
      if (extracted.text) {
        cues.push({
          id: `cue-srt-${cues.length + 1}`,
          index: cues.length + 1,
          start: Number(currentStart.toFixed(2)),
          end: Number(Math.max(currentStart + 0.4, currentEnd).toFixed(2)),
          speaker: extracted.speaker || 'Speaker 1',
          text: extracted.text,
          hasTimestamp: true,
        });
      }
    }
    currentStart = null;
    currentEnd = null;
    currentTextLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    if (!rawLine) {
      if (currentStart !== null) {
        flushTimedCue();
      }
      continue;
    }

    if (
      rawLine.startsWith('WEBVTT') ||
      rawLine.startsWith('Kind:') ||
      rawLine.startsWith('Language:') ||
      rawLine.startsWith('NOTE') ||
      rawLine.startsWith('STYLE')
    ) {
      continue;
    }

    // Timecode line: "00:00:01,000 --> 00:00:04,200" (or VTT settings at the end)
    if (rawLine.includes('-->')) {
      if (currentStart !== null) {
        flushTimedCue();
      }
      const [leftPart, rightPartRaw] = rawLine.split('-->');
      const rightToken = (rightPartRaw || '').trim().split(/\s+/)[0] || '';
      const startSec = parseTimestampToSeconds(leftPart.trim());
      const endSec = parseTimestampToSeconds(rightToken);
      if (startSec !== null && endSec !== null) {
        currentStart = startSec;
        currentEnd = Math.max(startSec + 0.35, endSec);
        currentTextLines = [];
        continue;
      }
    }

    // Numeric SRT cue index immediately preceding a timecode line
    if (/^\d+$/.test(rawLine)) {
      const nextNonEmpty = lines.slice(i + 1).find((l) => l.trim().length > 0)?.trim() || '';
      if (nextNonEmpty.includes('-->')) {
        if (currentStart !== null) flushTimedCue();
        continue;
      }
      if (currentStart === null && cues.length === 0) {
        continue;
      }
    }

    if (currentStart !== null) {
      currentTextLines.push(rawLine);
      continue;
    }

    // 3. Fallback for timestamped TXT lines like "[00:01 - 00:04] Speaker 1: Hello..."
    const txtTimedMatch = rawLine.match(
      /^\[(\d{1,3}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?(?:\.\d+)?)\]\s*(.+)$/
    );
    if (txtTimedMatch) {
      const startSec = parseTimestampToSeconds(txtTimedMatch[1]);
      const endSec = parseTimestampToSeconds(txtTimedMatch[2]);
      const extracted = extractSpeakerPrefixFromText(txtTimedMatch[3]);
      if (startSec !== null && endSec !== null && extracted.text) {
        cues.push({
          id: `cue-txt-${cues.length + 1}`,
          index: cues.length + 1,
          start: Number(startSec.toFixed(2)),
          end: Number(Math.max(startSec + 0.4, endSec).toFixed(2)),
          speaker: extracted.speaker || 'Speaker 1',
          text: extracted.text,
          hasTimestamp: true,
        });
        continue;
      }
    }

    // 4. Plain TXT lines (no timestamps, possibly "Speaker 1: ..." / "Speaker 2: ...")
    const cleanedLine = rawLine
      .replace(/\[\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)?\]/g, '')
      .trim();
    const extracted = extractSpeakerPrefixFromText(cleanedLine);
    if (extracted.text) {
      const prevEnd = cues.length > 0 ? cues[cues.length - 1].end : 0;
      const wordCount = Math.max(1, extracted.text.split(/\s+/).length);
      const estDur = Number(Math.max(1.2, wordCount / 2.4).toFixed(2));
      cues.push({
        id: `cue-plain-${cues.length + 1}`,
        index: cues.length + 1,
        start: Number(prevEnd.toFixed(2)),
        end: Number((prevEnd + estDur).toFixed(2)),
        speaker: extracted.speaker || 'Speaker 1',
        text: extracted.text,
        hasTimestamp: false,
      });
    }
  }

  flushTimedCue();
  return cues;
}

export function extractUniqueSpeakersFromCues(cues: readonly { speaker?: string }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const cue of cues) {
    const sp = (cue.speaker || 'Speaker 1').trim() || 'Speaker 1';
    if (!seen.has(sp)) {
      seen.add(sp);
      ordered.push(sp);
    }
  }
  return ordered.length > 0 ? ordered : ['Speaker 1'];
}

export function convertSegmentsToCues(
  segmentsInput: readonly TranscriptSegment[] | string
): StructuredSubtitleCue[] {
  let rawList: readonly TranscriptSegment[] = [];
  if (typeof segmentsInput === 'string') {
    try {
      const parsed = JSON.parse(segmentsInput);
      if (Array.isArray(parsed)) rawList = parsed;
    } catch {
      return parseSubtitleToCues(segmentsInput);
    }
  } else if (Array.isArray(segmentsInput)) {
    rawList = segmentsInput;
  }

  const cues: StructuredSubtitleCue[] = [];
  for (let idx = 0; idx < rawList.length; idx++) {
    const seg = rawList[idx];
    if (!seg || typeof seg.text !== 'string') continue;
    const rawText = seg.text.trim();
    if (!rawText) continue;

    const extracted = extractSpeakerPrefixFromText(rawText);
    const cleanText = extracted.text;
    if (!cleanText) continue;

    const rawStart = Number(seg.start);
    const rawEnd = Number(seg.end);
    const hasTimestamp = Number.isFinite(rawStart) && Number.isFinite(rawEnd) && rawStart >= 0;
    const safeStart = hasTimestamp ? rawStart : idx * 3;
    const safeEnd = hasTimestamp ? Math.max(safeStart + 0.4, rawEnd) : safeStart + 2.5;

    const explicitSpeaker = (seg.speaker || '').trim();
    const resolvedSpeaker =
      explicitSpeaker && !(explicitSpeaker.toLowerCase() === 'speaker 1' && extracted.speaker)
        ? normalizeSpeakerName(explicitSpeaker)
        : extracted.speaker || 'Speaker 1';

    cues.push({
      id: String(seg.id || `cue-seg-${cues.length + 1}`),
      index: cues.length + 1,
      start: Number(safeStart.toFixed(2)),
      end: Number(safeEnd.toFixed(2)),
      speaker: resolvedSpeaker,
      text: cleanText,
      hasTimestamp,
    });
  }

  return cues;
}

/**
 * Parses external subtitle files (.srt, .vtt, .txt, .json) into readable spoken script text.
 * Preserves line structure cleanly when multiple speakers exist.
 */
export function parseSubtitleToPlainText(content: string): string {
  const cues = parseSubtitleToCues(content);
  if (cues.length === 0) return '';
  const speakers = extractUniqueSpeakersFromCues(cues);
  if (speakers.length > 1) {
    return cues.map((c) => `${c.speaker}: ${c.text}`).join('\n');
  }
  return cues.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converts a text script into timed subtitle segments proportional to audio duration.
 * This guarantees the Subtitle Studio timeline matches the recorded audio with precision.
 */
export function createSegmentsFromScript(
  scriptText: string,
  totalDurationSeconds: number,
  speakerName: string = 'Speaker 1'
): TranscriptSegment[] {
  const clean = (scriptText || '').replace(/\s+/g, ' ').trim();
  const safeDuration = Number.isFinite(totalDurationSeconds) && totalDurationSeconds > 0
    ? totalDurationSeconds
    : 10;

  if (!clean) {
    return [
      {
        id: `seg-${Date.now()}-1`,
        start: 0,
        end: safeDuration,
        speaker: speakerName,
        text: 'Voice recording audio',
      },
    ];
  }

  // Split on punctuation (. ! ? । \n) while preserving sentence integrity
  const rawSentences = clean
    .split(/(?<=[.!?।])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rawSentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= 14) {
      chunks.push(sentence);
    } else {
      // Chunk long sentences into readable subtitle phrases (~8-12 words)
      let current: string[] = [];
      for (const word of words) {
        current.push(word);
        if (current.length >= 10) {
          chunks.push(current.join(' '));
          current = [];
        }
      }
      if (current.length > 0) {
        chunks.push(current.join(' '));
      }
    }
  }

  const finalChunks = chunks.length > 0 ? chunks : [clean];
  const totalChars = finalChunks.reduce((sum, c) => sum + c.length, 0) || 1;

  let currentStart = 0;
  return finalChunks.map((chunk, index) => {
    const isLast = index === finalChunks.length - 1;
    const proportion = chunk.length / totalChars;
    const rawDuration = proportion * safeDuration;
    const duration = isLast
      ? Math.max(0.5, safeDuration - currentStart)
      : Math.max(0.5, Number(rawDuration.toFixed(2)));

    const start = Number(currentStart.toFixed(2));
    const end = isLast ? Number(safeDuration.toFixed(2)) : Number((start + duration).toFixed(2));
    currentStart = end;

    return {
      id: `vo-seg-${Date.now()}-${index + 1}`,
      start,
      end,
      speaker: speakerName,
      text: chunk,
    };
  });
}
