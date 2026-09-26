// Parser for Klippel-exported .txt measurement files (tab-separated, quoted
// fields). No DOM access: runs in Node (build step) and the browser alike.

export interface KlippelTrace {
  name: string;
  freqHz: number[];
  valueDb: number[];
}

export interface KlippelFile {
  title: string;
  unit: string;
  traces: KlippelTrace[];
}

function stripQuotes(field: string): string {
  const trimmed = field.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// Klippel exports use a thousands separator above 1000 ("1,034.91"). Strip it
// before parsing, or everything above 1 kHz is silently truncated by Number().
function parseNumber(field: string): number {
  return Number(field.replace(/,/g, ''));
}

/** Angle labels are not spelled consistently across Klippel export files
 * ("On-Axis" in SPL Horizontal/Vertical.txt vs "On Axis" in CEA2034.txt).
 * Normalize to the "On Axis" spelling everywhere else uses. */
export function normalizeTraceName(name: string): string {
  return name === 'On-Axis' ? 'On Axis' : name;
}

export function parseKlippelTxt(text: string): KlippelFile {
  const lines = text.split(/\r\n|\r|\n/);
  const title = stripQuotes(lines[0] ?? '');

  const nameFields = (lines[1] ?? '').split('\t');
  const names = nameFields.map(stripQuotes).filter((s) => s.length > 0).map(normalizeTraceName);

  const unitFields = (lines[2] ?? '').split('\t').map(stripQuotes);
  const unit = unitFields[1] ?? '';

  const traces: KlippelTrace[] = names.map((name) => ({ name, freqHz: [], valueDb: [] }));

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim().length === 0) continue;
    const fields = line.split('\t');
    for (let t = 0; t < traces.length; t++) {
      const freqField = fields[t * 2];
      const valueField = fields[t * 2 + 1];
      if (freqField === undefined || valueField === undefined) continue;
      const freq = parseNumber(freqField);
      const value = parseNumber(valueField);
      if (!Number.isFinite(freq) || !Number.isFinite(value)) continue;
      traces[t].freqHz.push(freq);
      traces[t].valueDb.push(value);
    }
  }

  return { title, unit, traces };
}
