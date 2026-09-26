import { describe, expect, it } from 'vitest';
import { parseKlippelTxt } from '../klippel';

describe('parseKlippelTxt', () => {
  it('strips the thousands separator so values above 1kHz are not truncated', () => {
    const text = [
      '"SPL Horizontal"\r',
      '"On-Axis"\t\t"10°"\r',
      '"Frequency [Hz]"\t"SPL [dB]"\t"Frequency [Hz]"\t"SPL [dB]"\r',
      '1,034.91\t85.94\t1,034.91\t80.12\r',
      '20,000\t60.00\t20,000\t59.00\r',
    ].join('\n');

    const file = parseKlippelTxt(text);
    expect(file.title).toBe('SPL Horizontal');
    expect(file.traces).toHaveLength(2);
    expect(file.traces[0].name).toBe('On Axis');
    expect(file.traces[0].freqHz).toEqual([1034.91, 20000]);
    expect(file.traces[0].valueDb).toEqual([85.94, 60.0]);
    expect(file.traces[1].freqHz).toEqual([1034.91, 20000]);
    expect(file.traces[1].valueDb).toEqual([80.12, 59.0]);
  });

  it('parses trace names in order, ignoring the blank pairing column', () => {
    const text = [
      '"CEA2034"\r',
      '"On Axis"\t\t"Listening Window"\t\t"Sound Power"\r',
      '"Frequency [Hz]"\t"dB"\t"Frequency [Hz]"\t"dB"\t"Frequency [Hz]"\t"dB"\r',
      '100\t70\t100\t69\t100\t65\r',
    ].join('\n');

    const file = parseKlippelTxt(text);
    expect(file.traces.map((t) => t.name)).toEqual(['On Axis', 'Listening Window', 'Sound Power']);
  });
});
