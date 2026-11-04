/**
 * The "visual bottle". Liquid level = remaining / total. Pure SVG, no images needed.
 * `reservedMl` (ordered but not yet poured) is shown as a lighter band on top.
 */
export function BottleGauge({
  id,
  totalMl,
  remainingMl,
  reservedMl = 0,
  size = 120,
}: {
  id: string;
  totalMl: number;
  remainingMl: number;
  reservedMl?: number;
  size?: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const available = clamp((remainingMl - reservedMl) / totalMl);
  const withReserved = clamp(remainingMl / totalMl);
  const clipId = `bottle-${id}`;
  const liquid = {
    transformBox: "fill-box" as const,
    transformOrigin: "bottom",
    transition: "transform 1.2s ease-in-out",
  };

  return (
    <svg
      viewBox="0 0 60 140"
      width={(size * 60) / 140}
      height={size}
      role="img"
      aria-label={`${Math.round(withReserved * 100)}% left`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M24 4 h12 v26 c0 8 16 12 16 26 v70 a8 8 0 0 1 -8 8 h-28 a8 8 0 0 1 -8 -8 v-70 c0 -14 16 -18 16 -26 z" />
        </clipPath>
        <linearGradient id={`${clipId}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="60" height="140" fill="#1f1f23" />
        {/* reserved band (lighter) */}
        <rect x="0" y="40" width="60" height="94" fill="#fcd34d" opacity="0.45" style={{ ...liquid, transform: `scaleY(${withReserved})` }} />
        {/* available liquid */}
        <rect x="0" y="40" width="60" height="94" fill={`url(#${clipId}-g)`} style={{ ...liquid, transform: `scaleY(${available})` }} />
        {/* glass shine */}
        <rect x="13" y="58" width="4" height="64" rx="2" fill="#ffffff" opacity="0.15" />
      </g>
      <path
        d="M24 4 h12 v26 c0 8 16 12 16 26 v70 a8 8 0 0 1 -8 8 h-28 a8 8 0 0 1 -8 -8 v-70 c0 -14 16 -18 16 -26 z"
        fill="none"
        stroke="#a3a3a3"
        strokeWidth="2"
      />
      <rect x="22" y="1" width="16" height="7" rx="2" fill="#78350f" />
    </svg>
  );
}
