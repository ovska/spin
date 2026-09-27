// Minimal inline icons for the cycling control buttons - no icon library
// dependency for three glyphs, and inline SVG (currentColor) follows the
// button's text color automatically in both themes.

export function SmoothIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M1 12 Q4.5 3 8 8 T15 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  );
}

export function RangeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <line x1="3" y1="13" x2="3" y2="6" />
        <line x1="8" y1="13" x2="8" y2="3" />
        <line x1="13" y1="13" x2="13" y2="8" />
      </g>
    </svg>
  );
}

export function SpanIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 1 L8 15" />
        <path d="M8 1 L5 4" />
        <path d="M8 1 L11 4" />
        <path d="M8 15 L5 12" />
        <path d="M8 15 L11 12" />
      </g>
    </svg>
  );
}
