const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDuration(input: string): number | null {
  const matches = input.trim().toLowerCase().matchAll(/(\d+)\s*(s|m|h|d)/g);
  let total = 0;
  let found = false;
  for (const m of matches) {
    const value = Number.parseInt(m[1]!, 10);
    const unit = UNIT_MS[m[2]!]!;
    total += value * unit;
    found = true;
  }
  if (!found || total <= 0) return null;
  return total;
}

export function humanizeDuration(ms: number): string {
  const units: [number, string, string][] = [
    [86_400_000, 'día', 'días'],
    [3_600_000, 'hora', 'horas'],
    [60_000, 'minuto', 'minutos'],
    [1000, 'segundo', 'segundos'],
  ];
  const parts: string[] = [];
  let rest = ms;
  for (const [size, singular, plural] of units) {
    const n = Math.floor(rest / size);
    if (n > 0) {
      parts.push(`${n} ${n === 1 ? singular : plural}`);
      rest -= n * size;
    }
  }
  return parts.join(' y ') || '0 segundos';
}
