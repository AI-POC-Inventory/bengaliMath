import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { getPreferences, setPreference, getDoubts, saveDoubt, askDoubt } from '../api/client';
import { toBengaliDate } from '../utils/bengali';
import type { DoubtEntry } from '../types';

interface Props {
  classId: number;
  darkMode: boolean;
}

export default function DoubtSolver({ classId, darkMode }: Props) {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<DoubtEntry[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const inputBg = darkMode ? '#0f172a' : '#f1f5f9';

  useEffect(() => {
    getPreferences().then(prefs => {
      setHasApiKey(!!prefs.apiKey);
      setShowApiKeyForm(!prefs.apiKey);
    }).catch(() => {});

    getDoubts(classId).then(setHistory).catch(() => {});
  }, [classId]);

  async function saveKey() {
    if (!apiKeyInput.trim()) return;
    await setPreference('api_key', apiKeyInput.trim()).catch(() => {});
    setHasApiKey(true);
    setShowApiKeyForm(false);
    setApiKeyInput('');
  }

  async function askQuestion() {
    if (!question.trim() || loading) return;
    if (!hasApiKey) { setShowApiKeyForm(true); return; }

    setLoading(true);
    setResponse('');
    let fullResponse = '';

    try {
      for await (const chunk of askDoubt(classId, question.trim(), topic.trim())) {
        fullResponse += chunk;
        setResponse(fullResponse);
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
      }

      const entry: DoubtEntry = {
        id: Date.now().toString(),
        classId,
        question: question.trim(),
        topic: topic.trim() || undefined,
        response: fullResponse,
        date: new Date().toISOString(),
      };
      await saveDoubt(entry).catch(() => {});
      setHistory((prev: DoubtEntry[]) => [entry, ...prev]);
      setQuestion('');
      setTopic('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      if (msg.includes('authentication') || msg.includes('401') || msg.includes('API key')) {
        setResponse('API কী সঠিক নয়। অনুগ্রহ করে আপনার Anthropic API কী যাচাই করুন।');
        setHasApiKey(false);
        setShowApiKeyForm(true);
      } else {
        setResponse(`ত্রুটি: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '0.7rem',
    border: `1px solid ${border}`,
    background: inputBg,
    color: text,
    fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100%', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: text, marginBottom: '0.5rem' }}>
        🤖 সন্দেহ সমাধান
      </h1>
      <p style={{ color: subText, marginBottom: '2rem', fontSize: '0.9rem' }}>
        যেকোনো গণিত প্রশ্ন বাংলায় জিজ্ঞেস করুন — AI বাংলায় সমাধান দেবে
      </p>

      {/* API Key Setup */}
      {showApiKeyForm && (
        <div style={{
          background: '#f59e0b15',
          border: '1px solid #f59e0b40',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ color: '#f59e0b', margin: '0 0 0.8rem', fontSize: '1rem', fontWeight: '600' }}>
            🔑 Anthropic API কী প্রয়োজন
          </h3>
          <p style={{ color: subText, fontSize: '0.85rem', margin: '0 0 1rem' }}>
            AI ডাউট সলভার ব্যবহার করতে আপনার Anthropic API কী দিন। এটি সার্ভারে নিরাপদে সংরক্ষিত হবে।
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={saveKey}
              style={{
                padding: '0.75rem 1.2rem',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '0.7rem',
                cursor: 'pointer',
                fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              সংরক্ষণ
            </button>
          </div>
          {hasApiKey && (
            <button
              onClick={() => setShowApiKeyForm(false)}
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: subText, cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
            >
              বাতিল করুন
            </button>
          )}
        </div>
      )}

      {/* Question input */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '0.8rem' }}>
          <input
            type="text"
            placeholder="বিষয়ের নাম (ঐচ্ছিক) — যেমন: ভগ্নাংশ, সমীকরণ"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '0.8rem' }}>
          <textarea
            placeholder="আপনার গণিত প্রশ্নটি এখানে লিখুন..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) askQuestion(); }}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: subText, fontSize: '0.8rem' }}>Ctrl+Enter দিয়ে পাঠান</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {hasApiKey && (
              <button
                onClick={() => { setShowApiKeyForm(true); setApiKeyInput(''); }}
                style={{
                  padding: '0.6rem 1rem',
                  background: 'transparent',
                  border: `1px solid ${border}`,
                  borderRadius: '0.6rem',
                  color: subText,
                  cursor: 'pointer',
                  fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                  fontSize: '0.85rem',
                }}
              >
                API কী পরিবর্তন
              </button>
            )}
            <button
              onClick={askQuestion}
              disabled={loading || !question.trim()}
              style={{
                padding: '0.7rem 1.5rem',
                background: loading || !question.trim() ? border : '#3b82f6',
                color: loading || !question.trim() ? subText : 'white',
                border: 'none',
                borderRadius: '0.6rem',
                cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                fontWeight: '600',
                fontSize: '0.95rem',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {loading ? (
                <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> সমাধান হচ্ছে...</>
              ) : 'জিজ্ঞেস করুন →'}
            </button>
          </div>
        </div>
      </div>

      {/* Response */}
      {(response || loading) && (
        <div style={{
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🤖</span>
            <span style={{ color: text, fontWeight: '600', fontSize: '0.95rem' }}>
              AI উত্তর {loading && <span style={{ color: '#3b82f6' }}>লিখছে...</span>}
            </span>
          </div>
          <div
            ref={responseRef}
            style={{
              color: text,
              lineHeight: 1.8,
              fontSize: '0.95rem',
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            {response || <span style={{ color: subText }}>...</span>}
            {loading && <span style={{ display: 'inline-block', animation: 'pulse 0.8s ease-in-out infinite', color: '#3b82f6' }}>▋</span>}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 style={{ color: text, fontWeight: '600', fontSize: '1rem', marginBottom: '1rem' }}>
            🕐 আগের প্রশ্নসমূহ
          </h3>
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {history.slice(0, 5).map(entry => (
              <div
                key={entry.id}
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: '0.8rem',
                  padding: '1rem',
                }}
              >
                <div style={{ color: text, fontWeight: '500', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                  {entry.question}
                </div>
                {entry.topic && (
                  <span style={{
                    background: '#3b82f620',
                    color: '#3b82f6',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.4rem',
                    fontSize: '0.75rem',
                  }}>{entry.topic}</span>
                )}
                <div style={{ color: subText, fontSize: '0.78rem', marginTop: '0.4rem' }}>
                  {toBengaliDate(entry.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
