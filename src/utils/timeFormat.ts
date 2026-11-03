/**
 * Formats seconds into mm:ss or hh:mm:ss for user-friendly player display
 */
export function formatPlayerTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats seconds into standard SubRip (SRT) format: 00:00:00,000
 */
export function formatSRTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00,000';
  const totalMilliseconds = Math.round(seconds * 1000);
  const hrs = Math.floor(totalMilliseconds / 3600000);
  const mins = Math.floor((totalMilliseconds % 3600000) / 60000);
  const secs = Math.floor((totalMilliseconds % 60000) / 1000);
  const ms = totalMilliseconds % 1000;

  const pad = (n: number, width = 2) => n.toString().padStart(width, '0');

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Converts Bengali digits (০-৯) to English digits and vice versa if needed
 */
export function toBengaliNumber(num: number | string): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .replace(/[0-9]/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}
