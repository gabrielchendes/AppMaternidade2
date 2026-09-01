import React from 'react';

export interface GlowingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  glow?: boolean;
  color?: 'primary' | 'blue' | 'emerald' | 'amber' | 'white';
  className?: string;
  fullScreen?: boolean;
  label?: string;
}

export function GlowingSpinner({
  size = 'md',
  glow = true,
  color = 'primary',
  className = '',
  fullScreen = false,
  label,
}: GlowingSpinnerProps) {
  let dimensionPx = 32;
  let borderWidth = 3;
  let glowSizePx = 64;

  if (typeof size === 'number') {
    dimensionPx = size;
    borderWidth = Math.max(2, Math.round(size / 12));
    glowSizePx = size * 2;
  } else {
    switch (size) {
      case 'xs':
        dimensionPx = 16;
        borderWidth = 2;
        glowSizePx = 32;
        break;
      case 'sm':
        dimensionPx = 20;
        borderWidth = 2.5;
        glowSizePx = 44;
        break;
      case 'md':
        dimensionPx = 32;
        borderWidth = 3;
        glowSizePx = 72;
        break;
      case 'lg':
        dimensionPx = 48;
        borderWidth = 3.5;
        glowSizePx = 96;
        break;
      case 'xl':
        dimensionPx = 64;
        borderWidth = 4;
        glowSizePx = 128;
        break;
    }
  }

  // Color specific mappings
  const colorMap = {
    primary: {
      borderTop: 'border-t-primary',
      glowBg: 'bg-primary/25',
      glowShadow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.45)]',
      textColor: 'text-primary',
    },
    blue: {
      borderTop: 'border-t-blue-500',
      glowBg: 'bg-blue-500/25',
      glowShadow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.45)]',
      textColor: 'text-blue-400',
    },
    emerald: {
      borderTop: 'border-t-emerald-500',
      glowBg: 'bg-emerald-500/25',
      glowShadow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.45)]',
      textColor: 'text-emerald-400',
    },
    amber: {
      borderTop: 'border-t-amber-400',
      glowBg: 'bg-amber-400/25',
      glowShadow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]',
      textColor: 'text-amber-400',
    },
    white: {
      borderTop: 'border-t-white',
      glowBg: 'bg-white/20',
      glowShadow: 'drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]',
      textColor: 'text-white',
    },
  };

  const selectedColor = colorMap[color] || colorMap.primary;

  const spinnerElement = (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center">
        {glow && (
          <div
            className={`absolute rounded-full ${selectedColor.glowBg} blur-xl pointer-events-none animate-pulse`}
            style={{
              width: `${glowSizePx}px`,
              height: `${glowSizePx}px`,
            }}
          />
        )}
        <div
          className={`rounded-full border-white/10 ${selectedColor.borderTop} ${selectedColor.glowShadow} spinner-smooth`}
          style={{
            width: `${dimensionPx}px`,
            height: `${dimensionPx}px`,
            borderWidth: `${borderWidth}px`,
            borderStyle: 'solid',
            willChange: 'transform',
          }}
        />
      </div>
      {label && (
        <span className={`mt-3 text-xs font-medium tracking-wide ${selectedColor.textColor} animate-pulse`}>
          {label}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#0b0c10] flex flex-col items-center justify-center relative overflow-hidden z-[200]">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
}

export default GlowingSpinner;
