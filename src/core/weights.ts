// CEA2034 / CTA-2034-A spatial sampling weights: each measurement angle
// represents a portion of the measurement sphere, so the sound-power average
// weights angles by that area rather than counting them equally.
//
// Ported directly from spinorama's src/spinorama/compute/cea2034.py
// (compute_area_q / compute_weigths / sp_weigths) at the pinned commit, to
// match its reference numbers.

function computeAreaQ(alphaDeg: number, betaDeg: number): number {
  const alpha = (alphaDeg * 2 * Math.PI) / 360;
  const beta = (betaDeg * 2 * Math.PI) / 360;
  const gamma = Math.acos(Math.cos(alpha) * Math.cos(beta));
  const a = Math.atan(Math.sin(beta) / Math.tan(alpha));
  const b = Math.atan(Math.sin(alpha) / Math.tan(beta));
  const c = Math.acos(-Math.cos(a) * Math.cos(b) + Math.sin(a) * Math.sin(b) * Math.cos(gamma));
  return 4 * c - 2 * Math.PI;
}

function computeWeights(): number[] {
  const angles = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => i * 10 + 5).concat([90]);
  const areaAtAngle = angles.map((a) => computeAreaQ(a, a));
  const weights = areaAtAngle.map((area, i) => (i === 0 ? area : area - areaAtAngle[i - 1]));
  weights[9] *= 2.0;
  return weights;
}

const STD_WEIGHTS = computeWeights();

/** Angle label (as used in the parsed Klippel traces) -> spatial weight. */
export const SP_WEIGHTS: Record<string, number> = {
  'On Axis': STD_WEIGHTS[0],
  '180°': STD_WEIGHTS[0],
  '-180°': STD_WEIGHTS[0],

  '10°': STD_WEIGHTS[1],
  '170°': STD_WEIGHTS[1],
  '-170°': STD_WEIGHTS[1],
  '-10°': STD_WEIGHTS[1],

  '20°': STD_WEIGHTS[2],
  '160°': STD_WEIGHTS[2],
  '-160°': STD_WEIGHTS[2],
  '-20°': STD_WEIGHTS[2],

  '30°': STD_WEIGHTS[3],
  '150°': STD_WEIGHTS[3],
  '-150°': STD_WEIGHTS[3],
  '-30°': STD_WEIGHTS[3],

  '40°': STD_WEIGHTS[4],
  '140°': STD_WEIGHTS[4],
  '-140°': STD_WEIGHTS[4],
  '-40°': STD_WEIGHTS[4],

  '50°': STD_WEIGHTS[5],
  '130°': STD_WEIGHTS[5],
  '-130°': STD_WEIGHTS[5],
  '-50°': STD_WEIGHTS[5],

  '60°': STD_WEIGHTS[6],
  '120°': STD_WEIGHTS[6],
  '-120°': STD_WEIGHTS[6],
  '-60°': STD_WEIGHTS[6],

  '70°': STD_WEIGHTS[7],
  '110°': STD_WEIGHTS[7],
  '-110°': STD_WEIGHTS[7],
  '-70°': STD_WEIGHTS[7],

  '80°': STD_WEIGHTS[8],
  '100°': STD_WEIGHTS[8],
  '-100°': STD_WEIGHTS[8],
  '-80°': STD_WEIGHTS[8],

  '90°': STD_WEIGHTS[9],
  '-90°': STD_WEIGHTS[9],
};
