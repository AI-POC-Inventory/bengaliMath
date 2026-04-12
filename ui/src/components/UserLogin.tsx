import { useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';
import type { User } from '../utils/storage';

interface Props {
  onLogin: (user: User) => void;
  darkMode: boolean;
  classId: number;
}

const API_BASE = 'http://localhost:3001';

export default function UserLogin({ onLogin, darkMode, classId }: Props) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bg = darkMode ? '#1a1a2e' : '#f0f4ff';
  const cardBg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const inputBg = darkMode ? '#0f1419' : '#f8fafc';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !displayName.trim()) {
      setError('অনুগ্রহ করে সব তথ্য পূরণ করুন');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          classId,
        }),
      });

      if (!response.ok) {
        throw new Error('ব্যবহারকারী তৈরি করতে সমস্যা হয়েছে');
      }

      const user = await response.json();
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অজানা সমস্যা');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      <div style={{
        background: cardBg,
        borderRadius: '1rem',
        padding: '2.5rem',
        maxWidth: '450px',
        width: '100%',
        border: `1px solid ${borderColor}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: text, margin: '0 0 0.5rem' }}>
            স্বাগতম!
          </h2>
          <p style={{ fontSize: '1rem', color: subText, margin: 0 }}>
            শ্রেণী {toBengaliNumber(classId)} — গণিত শিক্ষা
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: text,
              marginBottom: '0.5rem',
            }}>
              ব্যবহারকারীর নাম (ইংরেজিতে)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="যেমন: student123"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                background: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: text,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: text,
              marginBottom: '0.5rem',
            }}>
              প্রদর্শনের নাম
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="যেমন: রাহুল শর্মা"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                background: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: text,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              color: '#991b1b',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '1.1rem',
              fontWeight: '600',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? 'অপেক্ষা করুন...' : 'শুরু করুন'}
          </button>
        </form>

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.875rem',
          color: subText,
          textAlign: 'center',
        }}>
          আপনার অগ্রগতি সংরক্ষিত থাকবে
        </p>
      </div>
    </div>
  );
}
