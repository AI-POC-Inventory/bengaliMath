import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface Badge {
  id: string;
  name_bengali: string;
  icon: string;
}

interface Props {
  badges?: Badge[];
  leveledUp?: boolean;
  newLevel?: number;
  streak?: number;
  darkMode: boolean;
  onClose?: () => void;
}

export default function AchievementNotification({
  badges = [],
  leveledUp = false,
  newLevel,
  streak,
  darkMode,
  onClose,
}: Props) {
  const [visible, setVisible] = useState(false);

  const bg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const overlayBg = darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';

  useEffect(() => {
    // Show notification with animation
    setTimeout(() => setVisible(true), 100);

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  const hasAchievements = badges.length > 0 || leveledUp || (streak && streak > 0);

  if (!hasAchievements) return null;

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
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: bg,
          borderRadius: '1rem',
          padding: '2.5rem',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          transform: visible ? 'scale(1)' : 'scale(0.8)',
          transition: 'transform 0.3s',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti Animation */}
        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'bounce 0.5s ease-in-out' }}>
          🎉
        </div>

        <h2 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: text,
          marginBottom: '1.5rem',
        }}>
          অভিনন্দন!
        </h2>

        {/* Level Up */}
        {leveledUp && newLevel && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: badges.length > 0 ? '1.5rem' : 0,
            color: 'white',
          }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              ⭐ লেভেল আপ! ⭐
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
              লেভেল {toBengaliNumber(newLevel)}
            </div>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: text,
              marginBottom: '1rem',
            }}>
              নতুন ব্যাজ অর্জিত!
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    color: '#78350f',
                  }}
                >
                  <span style={{ fontSize: '2.5rem' }}>{badge.icon}</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {badge.name_bengali}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streak */}
        {streak && streak > 0 && (
          <div style={{
            marginTop: badges.length > 0 || leveledUp ? '1.5rem' : 0,
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '0.75rem',
            padding: '1rem',
            color: '#78350f',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔥</span>
              <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                {toBengaliNumber(streak)} দিনের স্ট্রীক!
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            marginTop: '2rem',
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: '600',
            background: '#4ade80',
            color: '#064e3b',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          চালিয়ে যান
        </button>
      </div>

      <style>
        {`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
        `}
      </style>
    </div>
  );
}
