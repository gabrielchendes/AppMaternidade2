import React from 'react';

interface AskVictoriaIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  isActive?: boolean;
}

export function AskVictoriaIcon({
  size = 32,
  isActive = false,
  className = '',
  ...props
}: AskVictoriaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isActive ? 2.2 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Balão de Fala com Perna Alongada e Direcionada ao Espaço Vazio da Esquerda */}
      <path
        d="M 12 5.4 C 15.3 5.4, 18 7.9, 18 11.1 C 18 14.3, 15.3 16.8, 12 16.8 C 10.6 16.8, 9.3 16.5, 8.3 16.0 L 4.6 19.8 L 6.6 14.3 C 6.2 13.3, 6.0 12.2, 6.0 11.1 C 6.0 7.9, 8.7 5.4, 12 5.4 Z"
        fill={isActive ? 'currentColor' : 'none'}
        fillOpacity={isActive ? 0.18 : 0}
      />

      {/* 3 Pontinhos (...) alinhados no centro do balão */}
      <circle cx="9.5" cy="11.1" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.1" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11.1" r="0.85" fill="currentColor" stroke="none" />

      {/* Headset - Arco Superior Ampliado com Folga Perfeita no Topo */}
      <path d="M 2.5 11 A 9.5 9.5 0 0 1 12 1.5 A 9.5 9.5 0 0 1 21.5 11" />

      {/* Headset - Earpads Laterais Externas */}
      <rect x="0.5" y="9.2" width="2" height="4.8" rx="1" fill="currentColor" />
      <rect x="21.5" y="9.2" width="2" height="4.8" rx="1" fill="currentColor" />

      {/* Headset - Haste e Microfone Curvado com Espaçamento Limpo */}
      <path d="M 22.5 13 C 22.5 18, 18 21.5, 12 21.5 H 10.5" />
      <rect x="7.8" y="20.5" width="2.8" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export default AskVictoriaIcon;
