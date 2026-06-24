import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { CHAT_BASE } from '../api/client';
import { toBengaliDate } from '../utils/bengali';
import AudioInput from './AudioInput';

interface Props {
  classId: number;
  darkMode: boolean;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface QuickAction {
  id: string;
  category: string;
  question: string;
  icon: string;
}

export default function ChatAssistant({ classId, darkMode }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const inputBg = darkMode ? '#0f172a' : '#f1f5f9';
  const userMsgBg = darkMode ? '#3b82f6' : '#3b82f6';
  const assistantMsgBg = darkMode ? '#334155' : '#f1f5f9';

  useEffect(() => {
    loadConversations();
    loadQuickActions();
  }, [classId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadConversations() {
    try {
      const response = await fetch(`${CHAT_BASE}/conversations?classId=${classId}`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  async function loadQuickActions() {
    try {
      const response = await fetch(`${CHAT_BASE}/quick-actions?classId=${classId}`);
      const data = await response.json();
      setQuickActions(data);
    } catch (error) {
      console.error('Failed to load quick actions:', error);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const response = await fetch(`${CHAT_BASE}/conversations/${conversationId}/messages`);
      const data = await response.json();
      setMessages(data);
      setActiveConversation(conversationId);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  async function createNewConversation() {
    try {
      const response = await fetch(`${CHAT_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      });
      const newConv = await response.json();
      setConversations(prev => [newConv, ...prev]);
      setActiveConversation(newConv.id);
      setMessages([]);
      return newConv.id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }

  async function sendMessage(messageText?: string) {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || loading) return;

    let convId = activeConversation;
    if (!convId) {
      convId = await createNewConversation();
      if (!convId) return;
    }

    setLoading(true);
    setInputMessage('');
    setStreamingResponse('');

    // Optimistically add user message to UI
    const tempUserMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await fetch(`${CHAT_BASE}/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, classId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));
              if (data.text) {
                fullResponse += data.text;
                setStreamingResponse(fullResponse);
              }
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.done) {
                // Add assistant message
                const assistantMessage: Message = {
                  id: Date.now() + 1,
                  role: 'assistant',
                  content: fullResponse,
                  createdAt: new Date().toISOString(),
                };
                setMessages(prev => [...prev, assistantMessage]);
                setStreamingResponse('');
                loadConversations(); // Refresh conversation list
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      alert(`ত্রুটি: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!confirm('এই কথোপকথনটি মুছে ফেলতে চান?')) return;

    try {
      await fetch(`${CHAT_BASE}/conversations/${id}`, {
        method: 'DELETE',
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversation === id) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
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
    <div style={{
      display: 'flex',
      height: '100vh',
      background: bg,
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      {/* Sidebar - Conversation List */}
      {showSidebar && (
        <div style={{
          width: '300px',
          background: cardBg,
          borderRight: `1px solid ${border}`,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: `1px solid ${border}`,
          }}>
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              color: text,
              marginBottom: '1rem',
            }}>
              💬 চ্যাট সহায়ক
            </h2>
            <button
              onClick={createNewConversation}
              style={{
                width: '100%',
                padding: '0.7rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.6rem',
                cursor: 'pointer',
                fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                fontWeight: '600',
                fontSize: '0.9rem',
              }}
            >
              + নতুন কথোপকথন
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem',
          }}>
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                style={{
                  padding: '0.8rem',
                  margin: '0.3rem 0',
                  background: activeConversation === conv.id ? inputBg : 'transparent',
                  borderRadius: '0.6rem',
                  cursor: 'pointer',
                  border: `1px solid ${activeConversation === conv.id ? border : 'transparent'}`,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (activeConversation !== conv.id) {
                    e.currentTarget.style.background = inputBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeConversation !== conv.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: text,
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {conv.title}
                    </div>
                    <div style={{
                      color: subText,
                      fontSize: '0.75rem',
                      marginTop: '0.2rem',
                    }}>
                      {conv.messageCount} বার্তা • {toBengaliDate(conv.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: subText,
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                      padding: '0.2rem',
                    }}
                    title="মুছে ফেলুন"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          background: cardBg,
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: text,
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0.3rem 0.6rem',
              borderRadius: '0.5rem',
            }}
          >
            ☰
          </button>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: text, margin: 0 }}>
              বাংলা গণিত সহায়ক
            </h1>
            <p style={{ color: subText, fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
              যেকোনো গণিত প্রশ্ন জিজ্ঞেস করুন
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            background: bg,
          }}
        >
          {messages.length === 0 && !streamingResponse && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
              <h3 style={{ color: text, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                কথোপকথন শুরু করুন
              </h3>
              <p style={{ color: subText, fontSize: '0.9rem', marginBottom: '2rem' }}>
                নীচের যেকোনো প্রশ্ন বেছে নিন অথবা নিজের প্রশ্ন লিখুন
              </p>

              {/* Quick Actions */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '0.8rem',
                maxWidth: '800px',
                margin: '0 auto',
              }}>
                {quickActions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => sendMessage(action.question)}
                    style={{
                      padding: '1rem',
                      background: cardBg,
                      border: `1px solid ${border}`,
                      borderRadius: '0.8rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                      fontSize: '0.9rem',
                      color: text,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = inputBg;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = cardBg;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>
                      {action.icon}
                    </span>
                    {action.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '0.8rem 1rem',
                  borderRadius: msg.role === 'user' ? '1rem 1rem 0.2rem 1rem' : '1rem 1rem 1rem 0.2rem',
                  background: msg.role === 'user' ? userMsgBg : assistantMsgBg,
                  color: msg.role === 'user' ? 'white' : text,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {streamingResponse && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
              <div
                style={{
                  maxWidth: '70%',
                  padding: '0.8rem 1rem',
                  borderRadius: '1rem 1rem 1rem 0.2rem',
                  background: assistantMsgBg,
                  color: text,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {streamingResponse}
                <span style={{
                  display: 'inline-block',
                  animation: 'pulse 0.8s ease-in-out infinite',
                  color: '#3b82f6',
                  marginLeft: '0.2rem',
                }}>▋</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '1rem 1.5rem',
          background: cardBg,
          borderTop: `1px solid ${border}`,
        }}>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end' }}>
            <textarea
              placeholder="আপনার প্রশ্ন লিখুন..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={3}
              disabled={loading}
              style={{
                ...inputStyle,
                flex: 1,
                resize: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <button
                onClick={() => sendMessage()}
                disabled={loading || !inputMessage.trim()}
                style={{
                  padding: '0.8rem 1.5rem',
                  background: loading || !inputMessage.trim() ? border : '#3b82f6',
                  color: loading || !inputMessage.trim() ? subText : 'white',
                  border: 'none',
                  borderRadius: '0.7rem',
                  cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  whiteSpace: 'nowrap',
                  height: 'fit-content',
                }}
              >
                {loading ? '⏳ পাঠানো হচ্ছে...' : 'পাঠান →'}
              </button>
              <AudioInput
                onTranscribed={(text) => setInputMessage(prev => prev + text)}
                disabled={loading}
              />
            </div>
          </div>
          <div style={{ color: subText, fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Enter দিয়ে পাঠান • Shift+Enter দিয়ে নতুন লাইন • 🎤 দিয়ে বলুন
          </div>
        </div>
      </div>
    </div>
  );
}
