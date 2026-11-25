import React from 'react'

export interface DecimoIconProps {
  className?: string
}

/**
 * Icono SVG limpio representando un décimo oficial rectangular de Lotería Nacional
 * (esquinas ligeramente redondeadas, marco interior fino, sello circular y líneas de numeración,
 * sin muescas laterales de entrada de tómbola).
 */
export const DecimoIcon: React.FC<DecimoIconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Contorno rectangular del décimo */}
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      {/* Marco interior fino */}
      <rect x="5.2" y="6.7" width="13.6" height="10.6" rx="0.8" strokeWidth={1.1} opacity={0.65} />
      {/* Pequeño sello circular en esquina superior derecha */}
      <circle cx="15.8" cy="9.6" r="1.4" strokeWidth={1.3} />
      {/* Líneas de numeración y cabecera */}
      <line x1="7.5" y1="9.6" x2="12.2" y2="9.6" strokeWidth={1.6} />
      <line x1="7.5" y1="12.8" x2="16.5" y2="12.8" strokeWidth={1.3} />
      <line x1="7.5" y1="15.1" x2="13.5" y2="15.1" strokeWidth={1.3} />
    </svg>
  )
}
