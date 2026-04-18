import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface LevelInfo {
  level: number;
  name: string;
  icon: string;
}

interface Props {
  oldLevel: number;
  newLevel: LevelInfo;
  darkMode: boolean;
  onComplete?: () => void;
}

export default function LevelUpAnimation({ oldLevel, newLevel, darkMode, onComplete }: Props) {
  const [stage, setStage] = useState<'enter' | 'show' | 'exit'>('enter');

  const overlayBg = darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)';

  useEffect(() => {
    // Enter animation
    setTimeout(() => setStage('show'), 100);

    // Auto exit after 4 seconds
    const exitTimer = setTimeout(() => {
      setStage('exit');
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }, 4000);

    return () => clearTimeout(exitTimer);
  }, []);

  const handleClick = () => {
    setStage('exit');
    setTimeout(() => {
      onComplete?.();
    }, 500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: overlayBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: stage === 'show' ? 1 : 0,
        transition: 'opacity 0.5s',
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}
      onClick={handleClick}
    >
      {/* Radial light effect */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          transform: stage === 'show' ? 'scale(1) translateY(0)' : 'scale(0.5) translateY(50px)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Level Up Text */}
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '2rem',
            animation: 'glow 1.5s ease-in-out infinite',
            textShadow: '0 0 40px rgba(251, 191, 36, 0.5)',
          }}
        >
          ⭐ লেভেল আপ! ⭐
        </div>

        {/* Level transition */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
          {/* Old Level */}
          <div
            style={{
              opacity: 0.6,
              animation: 'slideOutLeft 0.5s ease-out 0.5s forwards',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>
              {getIconForLevel(oldLevel)}
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#94a3b8',
            }}>
              {toBengaliNumber(oldLevel)}
            </div>
          </div>

          {/* Arrow */}
          <div
            style={{
              fontSize: '3rem',
              color: '#667eea',
              animation: 'bounce 1s ease-in-out infinite',
            }}
          >
            →
          </div>

          {/* New Level */}
          <div
            style={{
              animation: 'scaleIn 0.5s ease-out 0.5s backwards',
            }}
          >
            <div
              style={{
                fontSize: '6rem',
                marginBottom: '0.5rem',
                animation: 'rotate 2s ease-in-out infinite',
                filter: 'drop-shadow(0 0 20px rgba(102, 126, 234, 0.8))',
              }}
            >
              {newLevel.icon}
            </div>
            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {toBengaliNumber(newLevel.level)}
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#e2e8f0',
              marginTop: '0.5rem',
            }}>
              {newLevel.name}
            </div>
          </div>
        </div>

        {/* Congratulations message */}
        <div
          style={{
            fontSize: '1.25rem',
            color: '#e2e8f0',
            marginBottom: '1rem',
            animation: 'fadeIn 0.5s ease-out 1s backwards',
          }}
        >
          অভিনন্দন! আপনি নতুন উচ্চতায় পৌঁছেছেন!
        </div>

        {/* Continue button */}
        <button
          onClick={handleClick}
          style={{
            padding: '1rem 3rem',
            fontSize: '1.25rem',
            fontWeight: '600',
            background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
            color: '#064e3b',
            border: 'none',
            borderRadius: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 8px 16px rgba(74, 222, 128, 0.3)',
            transition: 'all 0.2s',
            animation: 'fadeIn 0.5s ease-out 1.5s backwards',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(74, 222, 128, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(74, 222, 128, 0.3)';
          }}
        >
          চালিয়ে যান
        </button>

        {/* Fireworks particles */}
        <Fireworks />
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }

          @keyframes glow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          @keyframes rotate {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(10deg); }
          }

          @keyframes scaleIn {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes slideOutLeft {
            to {
              transform: translateX(-50px);
              opacity: 0;
            }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes firework {
            0% {
              transform: translate(0, 0);
              opacity: 1;
            }
            100% {
              transform: translate(var(--tx), var(--ty));
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
}

function Fireworks() {
  const particles = [];
  const colors = ['#fbbf24', '#f59e0b', '#667eea', '#764ba2', '#4ade80', '#22c55e'];

  for (let i = 0; i < 30; i++) {
    const angle = (Math.PI * 2 * i) / 30;
    const distance = 200 + Math.random() * 100;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const delay = Math.random() * 0.5;
    const duration = 1 + Math.random() * 0.5;

    particles.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '8px',
          height: '8px',
          background: color,
          borderRadius: '50%',
          // @ts-ignore
          '--tx': `${tx}px`,
          '--ty': `${ty}px`,
          animation: `firework ${duration}s ease-out ${delay}s infinite`,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    );
  }

  return <>{particles}</>;
}

// Helper function to get icon for old levels
function getIconForLevel(level: number): string {
  const icons = ['🌱', '🌿', '🌾', '🌳', '🎯', '⭐', '📚', '🏆', '👑', '💎'];
  return icons[Math.min(level - 1, icons.length - 1)] || '⭐';
}
