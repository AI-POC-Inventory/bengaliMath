import { useState, useEffect } from 'react';

interface UserProfileProps {
  darkMode: boolean;
  onSave: (name: string) => void;
  onBack: () => void;
}

export default function UserProfile({ darkMode, onSave, onBack }: UserProfileProps) {
  const [userName, setUserName] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('userName');
    if (stored) {
      setUserName(stored);
    }
  }, []);

  const handleSave = () => {
    if (userName.trim()) {
      localStorage.setItem('userName', userName.trim());
      onSave(userName.trim());
      setEditing(false);
    }
  };

  const bgColor = darkMode ? '#111827' : '#F9FAFB';
  const cardBg = darkMode ? '#1F2937' : '#FFFFFF';
  const textColor = darkMode ? '#F9FAFB' : '#1F2937';
  const subtextColor = darkMode ? '#9CA3AF' : '#6B7280';
  const borderColor = darkMode ? '#374151' : '#E5E7EB';

  return (
    <div style={{
      backgroundColor: bgColor,
      minHeight: '100vh',
      paddingBottom: '80px',
    }}>
      <div style={{
        padding: '24px 20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: textColor,
              padding: '8px',
            }}
          >
            ←
          </button>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: textColor,
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
          }}>
            প্রোফাইল
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '32px',
        }}>
          <div style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            backgroundColor: '#A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            fontWeight: 700,
            color: '#047857',
            marginBottom: '16px',
          }}>
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          {!editing && (
            <div style={{
              fontSize: '20px',
              fontWeight: 600,
              color: textColor,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              marginBottom: '8px',
            }}>
              {userName || 'User'}
            </div>
          )}
          {editing ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: cardBg,
                  color: textColor,
                  fontSize: '16px',
                  fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10B981',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                backgroundColor: cardBg,
                color: textColor,
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              }}
            >
              Edit Name
            </button>
          )}
        </div>

        <div style={{
          backgroundColor: cardBg,
          borderRadius: '16px',
          border: `1px solid ${borderColor}`,
          padding: '20px',
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 600,
            color: textColor,
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            marginBottom: '16px',
          }}>
            Stats
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: subtextColor, fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
                Current Streak
              </span>
              <span style={{ color: textColor, fontWeight: 600 }}>
                {localStorage.getItem('userStreak') || '7'} দিন
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: subtextColor, fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
                Total Points
              </span>
              <span style={{ color: textColor, fontWeight: 600 }}>
                {localStorage.getItem('userPoints') || '248'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: subtextColor, fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
                Lessons Completed
              </span>
              <span style={{ color: textColor, fontWeight: 600 }}>
                {localStorage.getItem('lessonsCompleted') || '12'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
