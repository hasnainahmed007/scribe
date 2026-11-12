import { TranscriptSegment } from '../types';

/**
 * Parses external subtitle files (.srt, .vtt, .txt, .json) into clean spoken text
 * for high-fidelity voiceover synthesis, stripping indices, timecodes, and markup tags.
 */
export function parseSubtitleToPlainText(content: string): string {
  if (!content) return '';

  // 1. Try parsing JSON format (e.g. Scriby JSON export)
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.segments)) {
      return parsed.segments
        .map((s: any) => s.text)
        .filter(Boolean)
        .join(' ');
    }
    if (parsed && parsed.fullTranscript) {
      return parsed.fullTranscript;
    }
  } catch {}

  // 2. Parse SRT / VTT / TXT plain lines
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Skip WEBVTT header or note lines
    if (rawLine.startsWith('WEBVTT') || rawLine.startsWith('NOTE') || rawLine.startsWith('STYLE')) {
      continue;
    }

    // Skip numeric sequence IDs (e.g. "1", "2")
    if (/^\d+$/.test(rawLine)) continue;

    // Skip timecode lines containing "-->" (e.g. 00:00:01,000 --> 00:00:04,000)
    if (rawLine.includes('-->')) continue;

    // Strip bracketed time codes like [00:01 - 00:04]
    let line = rawLine
      .replace(/\[\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)?\]/g, '')
      .trim();

    // Strip speaker prefixes like "Speaker 1:" or "Kabir:"
    line = line.replace(/^(?:Speaker\s*\d+|[A-Za-z0-9_-]+)\s*:\s*/i, '');

    // Strip HTML/XML tags (e.g., <i>, <b>, <font color="...">)
    line = line.replace(/<[^>]*>/g, '').trim();

    if (line) {
      textLines.push(line);
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
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
