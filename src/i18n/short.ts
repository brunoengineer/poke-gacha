// Big numbers in little room: exact below 1,000, then 1.3k, 240k, 2m, 300m, 4b (and t past that). Rounds down, so a
// number never shows more than it is, and 999,999 stays "999k" instead of turning into "1000k".

const UNITS: [number, string][] = [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];

export function shortNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '∞';
  const size = Math.abs(value);
  for (const [unit, suffix] of UNITS) {
    if (size < unit) continue;
    const scaled = size / unit;
    // One decimal while it's a single digit (1.3k), none after (240k).
    const digits = scaled < 10 ? 1 : 0;
    const cut = Math.floor(scaled * 10 ** digits) / 10 ** digits;
    return `${value < 0 ? '-' : ''}${cut.toLocaleString(locale, { maximumFractionDigits: digits })}${suffix}`;
  }
  return value.toLocaleString(locale);
}
