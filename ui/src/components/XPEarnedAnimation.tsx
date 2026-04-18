import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface Props {
  xpAmount: number;
  reason?: string;
  position?: { x: number; y: number };
  onComplete?: () => void;
  darkMode?: boolean;
}

export default function XPEarnedAnimation({
  xpAmount,
  reason,
  position,
  onComplete,
  darkMode = false,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show animation
    setTimeout(() => setVisible(true), 50);

    // Hide and cleanup after animation
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        onComplete?.();
      }, 300);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const defaultPosition = { x: 50, y: 50 }; // Center of screen
  const pos = position || defaultPosition;

  // Different colors based on XP amount
  const getColor = () => {
    if (xpAmount >= 100) return '#f59e0b'; // Gold for high XP
    if (xpAmount >= 50) return '#8b5cf6'; // Purple for medium XP
    return '#4ade80'; // Green for standard XP
  };

  const color = getColor();

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: visible
          ? 'translate(-50%, -100px) scale(1)'
          : 'translate(-50%, 0) scale(0.5)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s ease-out',
        zIndex: 999,
        pointerEvents: 'none',
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}
    >
      {/* XP Badge */}
      <div
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${adjustBrightness(color, -20)} 100%)`,
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '2rem',
          boxShadow: `0 8px 16px ${color}40`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          border: '3px solid white',
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>✨</span>
        <span>+{toBengaliNumber(xpAmount)} XP</span>
      </div>

      {/* Reason */}
      {reason && (
        <div
          style={{
            marginTop: '0.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: darkMode ? '#e2e8f0' : '#1e293b',
            background: darkMode ? 'rgba(22, 33, 62, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.5rem',
            fontWeight: '600',
          }}
        >
          {reason}
        </div>
      )}

      {/* Sparkles */}
      <Sparkles color={color} />
    </div>
  );
}

function Sparkles({ color }: { color: string }) {
  const sparkles = [
    { delay: 0, x: -30, y: -20, size: 8 },
    { delay: 100, x: 30, y: -15, size: 10 },
    { delay: 200, x: -20, y: 10, size: 6 },
    { delay: 150, x: 25, y: 15, size: 8 },
    { delay: 50, x: 0, y: -30, size: 12 },
  ];

  return (
    <>
      {sparkles.map((sparkle, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `calc(50% + ${sparkle.x}px)`,
            top: `calc(50% + ${sparkle.y}px)`,
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            background: color,
            borderRadius: '50%',
            animation: `sparkle 1s ease-out ${sparkle.delay}ms`,
            opacity: 0,
          }}
        />
      ))}
      <style>
        {`
          @keyframes sparkle {
            0% {
              opacity: 0;
              transform: scale(0) rotate(0deg);
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
              transform: scale(1.5) rotate(180deg);
            }
          }
        `}
      </style>
    </>
  );
}

// Helper to adjust color brightness
function adjustBrightness(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Multi-XP Animation - for showing multiple XP gains in sequence
interface MultiXPProps {
  xpGains: Array<{ amount: number; reason: string }>;
  onComplete?: () => void;
  darkMode?: boolean;
}

export function MultiXPAnimation({ xpGains, onComplete, darkMode = false }: MultiXPProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleAnimationComplete = () => {
    if (currentIndex < xpGains.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 300);
    } else {
      onComplete?.();
    }
  };

  if (xpGains.length === 0) return null;

  return (
    <XPEarnedAnimation
      xpAmount={xpGains[currentIndex].amount}
      reason={xpGains[currentIndex].reason}
      onComplete={handleAnimationComplete}
      darkMode={darkMode}
    />
  );
}
