export function NexusLogo({ className = '', size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="nexus-grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="nexus-bg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e0a3c" />
          <stop offset="100%" stopColor="#0f0720" />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle cx="22" cy="22" r="21" fill="url(#nexus-bg)" stroke="url(#nexus-grad)" strokeWidth="1.5" />
      {/* Letter N */}
      <path
        d="M11 32V12L22 29V12M22 29V32M33 12V32"
        stroke="url(#nexus-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
