// Curve colors are semantic (what the curve *is*), never tied to which
// speaker is showing - flipping speakers must never change what a color
// means. Picked to stay distinguishable under common color-vision
// deficiencies (avoiding red/green as the only distinguishing pair).

export const CURVE_COLOR = {
  onAxis: '#1f77b4', // blue
  listeningWindow: '#2ca02c', // green
  earlyReflections: '#d68a00', // amber
  soundPower: '#7b52ae', // purple
  soundPowerDi: '#8c8c8c', // grey (right axis)
  earlyReflectionsDi: '#c2790a', // amber, darker (right axis)
  estimatedInRoom: '#1f77b4', // blue (In-room's single main curve)
  targetSlope: '#8c8c8c',
  reference: '#999999',
} as const;

export const GRID_COLOR = 'rgba(128,128,128,0.15)';
export const AXIS_COLOR = 'rgba(128,128,128,0.6)';
