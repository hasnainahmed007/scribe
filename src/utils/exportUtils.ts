import { Document, Paragraph, TextRun, Packer, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } from 'docx';
import { TranscriptSegment } from '../types';
import { formatSRTTime, formatPlayerTime } from './timeFormat';

/**
 * Generates SubRip (.srt) subtitle string
 */
export function generateSRT(segments: TranscriptSegment[]): string {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((seg, index) => {
      const srtIndex = index + 1;
      const startCode = formatSRTTime(seg.start);
      const endCode = formatSRTTime(seg.end);
      const text = seg.text.trim();
      return `${srtIndex}\n${startCode} --> ${endCode}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Generates Plain Text (.txt) transcript string
 */
export function generateTXT(
  segments: TranscriptSegment[],
  includeTimestamps: boolean = true,
  includeSpeakers: boolean = true
): string {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((seg) => {
      const prefixParts: string[] = [];
      if (includeTimestamps) {
        prefixParts.push(`[${formatPlayerTime(seg.start)} - ${formatPlayerTime(seg.end)}]`);
      }
      if (includeSpeakers && seg.speaker) {
        prefixParts.push(`${seg.speaker}:`);
      }
      const prefix = prefixParts.length > 0 ? `${prefixParts.join(' ')} ` : '';
      return `${prefix}${seg.text.trim()}`;
    })
    .join('\n\n');
}

/**
 * Generates Structured JSON string
 */
export function generateJSON(segments: TranscriptSegment[], metadata?: Record<string, any>): string {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    language: 'bn',
    totalSegments: segments.length,
    duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    metadata: metadata || {},
    segments: segments.map((seg, index) => ({
      index: index + 1,
      start: seg.start,
      end: seg.end,
      startTimecode: formatSRTTime(seg.start),
      endTimecode: formatSRTTime(seg.end),
      speaker: seg.speaker,
      text: seg.text,
    })),
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Generates and triggers download of a native Microsoft Word (.docx) file
 */
export async function downloadDOCX(
  segments: TranscriptSegment[],
  title: string = 'Audio Transcription & Subtitles',
  summary: string = ''
): Promise<void> {
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: '0F172A' },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Time', bold: true, color: 'FFFFFF', size: 22 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: '0F172A' },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Speaker', bold: true, color: 'FFFFFF', size: 22 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          shading: { fill: '0F172A' },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Transcript', bold: true, color: 'FFFFFF', size: 22 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  segments.forEach((seg, idx) => {
    const isEven = idx % 2 === 0;
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            shading: isEven ? { fill: 'F8FAFC' } : { fill: 'FFFFFF' },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${formatPlayerTime(seg.start)} - ${formatPlayerTime(seg.end)}`,
                    size: 20,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: isEven ? { fill: 'F8FAFC' } : { fill: 'FFFFFF' },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: seg.speaker || 'Speaker',
                    bold: true,
                    size: 20,
                    color: '0F172A',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: isEven ? { fill: 'F8FAFC' } : { fill: 'FFFFFF' },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: seg.text,
                    size: 22,
                    color: '1E293B',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 36,
                color: '1ED760',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on: ${new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })} | Total Segments: ${segments.length}`,
                italics: true,
                color: '64748B',
                size: 20,
              }),
            ],
          }),
          new Paragraph({ text: '' }), // spacing
          ...(summary
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Summary: ', bold: true, size: 22, color: '0F172A' }),
                    new TextRun({ text: summary, size: 22, color: '334155' }),
                  ],
                }),
                new Paragraph({ text: '' }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
              insideVertical: { style: BorderStyle.NONE },
            },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${slugify(title)}.docx`);
}

/**
 * Triggers browser download of a text/blob payload
 */
export function triggerDownload(content: string | Blob, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF-]+/g, '_')
    .slice(0, 40) || 'transcript';
}
