import React from 'react';

interface AskVictoriaIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  isActive?: boolean;
}

export function AskVictoriaIcon({
  size = 24,
  isActive = false,
  className,
  ...props
}: AskVictoriaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isActive ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={isActive ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default AskVictoriaIcon;
