// Normalizes a speaker so its Listening Window mean over 300 Hz-3 kHz is
// 0 dB. The offset is computed once per speaker and applied to every view,
// so relative shapes (and directivity indices, which are already
// differences) are preserved.

function splToPressure(spl: number): number {
  return Math.pow(10, (spl - 105.0) / 20.0);
}

function pressureToSpl(pressure: number): number {
  return 105.0 + 20.0 * Math.log10(pressure);
}

export function energyMeanDb(freqHz: number[], valueDb: number[], fLo: number, fHi: number): number {
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < freqHz.length; i++) {
    if (freqHz[i] < fLo || freqHz[i] > fHi) continue;
    const p = splToPressure(valueDb[i]);
    sumSq += p * p;
    count++;
  }
  if (count === 0) return 0;
  return pressureToSpl(Math.sqrt(sumSq / count));
}

export function listeningWindowOffsetDb(freqHz: number[], listeningWindowDb: number[]): number {
  return energyMeanDb(freqHz, listeningWindowDb, 300, 3000);
}
