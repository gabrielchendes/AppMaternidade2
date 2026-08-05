import React from 'react';

interface CommunityIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  isActive?: boolean;
}

export function CommunityIcon({
  size = 24,
  strokeWidth = 2,
  isActive = false,
  className = '',
  ...props
}: CommunityIconProps) {
  const currentStrokeWidth = isActive ? Math.max(strokeWidth, 2.3) : strokeWidth;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={currentStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Esquerda - Mais no topo */}
      <circle cx="5.5" cy="6" r="2.3" />
      <path d="M1 15.5v-.8a4.5 4.5 0 0 1 4.5-4.2" />

      {/* Direita - Mais no topo */}
      <circle cx="18.5" cy="6" r="2.3" />
      <path d="M23 15.5v-.8a4.5 4.5 0 0 0-4.5-4.2" />

      {/* Centro - Maior e mais em baixo (destaque na frente) */}
      <circle cx="12" cy="9.8" r="3.2" />
      <path d="M5.5 21v-.8a6.5 6.5 0 0 1 13 0v.8" />
    </svg>
  );
}

export default CommunityIcon;
