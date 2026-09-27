// JSON schema written by the data build step (`npm run data`) and read at
// runtime. Kept generic: adding a fourth or fifth speaker, or a view a given
// speaker lacks, requires no shape changes here.

export interface CurveSet {
  freqHz: number[];
  onAxis?: number[];
  listeningWindow?: number[];
  earlyReflections?: number[];
  soundPower?: number[];
  soundPowerDi?: number[];
  earlyReflectionsDi?: number[];
  estimatedInRoom?: number[];
}

/** A measurement plane at the shared frequency grid: angle label (e.g.
 * "On Axis", "10°", "-10°") to a dB curve. Used by the runtime to interpolate
 * arbitrary angles/windows for Sweet spot and Off-axis. */
export type PlaneJson = Record<string, number[]>;

export interface SpeakerData {
  id: string;
  name: string;
  origin: string;
  license: string;
  freqHz: number[];
  cea2034?: CurveSet;
  horizontal?: PlaneJson;
  vertical?: PlaneJson;
}

export interface SpeakerIndexEntry {
  id: string;
  name: string;
  origin: string;
  views: {
    cea2034: boolean;
    inRoom: boolean;
    sweetSpot: boolean;
    offAxis: boolean;
  };
}

export interface DataIndex {
  speakers: SpeakerIndexEntry[];
}
