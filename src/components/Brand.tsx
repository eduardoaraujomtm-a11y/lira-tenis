/** Marca do Lira Tênis Clube (placeholder em SVG até subir o PNG oficial). */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="var(--color-lira-purple)" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-lira-yellow)" strokeWidth="4" />
      <circle cx="50" cy="50" r="30" fill="var(--color-lira-yellow)" />
      <path
        d="M20 50 Q50 30 80 50"
        fill="none"
        stroke="var(--color-lira-purple)"
        strokeWidth="3"
      />
      <text
        x="50" y="58" textAnchor="middle"
        fontSize="26" fontWeight="800" fill="var(--color-lira-purple)"
        fontFamily="var(--font-sans)"
      >
        LTC
      </text>
    </svg>
  );
}
