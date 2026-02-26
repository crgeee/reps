export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export function getUtcOffset(tz: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    return offsetPart?.value ?? '';
  } catch {
    return '';
  }
}

export function buildTimezoneOptions(): TimezoneOption[] {
  const allTz = Intl.supportedValuesOf('timeZone');
  const options = allTz.map((tz) => {
    const offset = getUtcOffset(tz);
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
    return { value: tz, label: `${city} (${offset})`, offset };
  });

  options.sort((a, b) => parseOffsetMinutes(a.offset) - parseOffsetMinutes(b.offset));
  return options;
}

export function parseOffsetMinutes(offset: string): number {
  const m = offset.match(/GMT([+-]?\d+)?(?::(\d+))?/);
  if (!m) return 0;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  return h * 60 + (h < 0 ? -min : min);
}

export function formatTimezoneDisplay(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  const offset = getUtcOffset(tz);
  return `${city} (${offset})`;
}

export function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
