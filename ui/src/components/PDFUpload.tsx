import { useState, useEffect } from 'react';
import { getAdminClasses, getAdminChapters, getAdminTopics } from '../api/client';
import type { AdminClass, AdminChapter, AdminTopic } from '../api/client';

interface Props {
  darkMode: boolean;
}

function useColors(dark: boolean) {
  return {
    bg: dark ? '#0f172a' : '#f8fafc',
    surface: dark ? '#1e293b' : '#ffffff',
    border: dark ? '#334155' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#1e293b',
    sub: dark ? '#94a3b8' : '#64748b',
    primary: '#2563eb',
    danger: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    inputBg: dark ? '#0f172a' : '#f8fafc',
  };
}

const font = "'Hind Siliguri', 'Noto Sans Bengali', sans-serif";

function btn(bg: string, color = '#fff', disabled = false): React.CSSProperties {
  return {
    background: disabled ? '#94a3b8' : bg,
    color,
    border: 'none',
    borderRadius: '0.4rem',
    padding: '0.45rem 1rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: font,
    fontSize: '0.9rem',
    fontWeight: 600,
    opacity: disabled ? 0.6 : 1,
  };
}

export default function PDFUpload({ darkMode }: Props) {
  const colors = useColors(darkMode);

  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);

  const [selectedClass, setSelectedClass] = useState<number | ''>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<string>('anthropic');

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Load classes on mount
  useEffect(() => {
    getAdminClasses().then(setClasses);
  }, []);

  // Load chapters when class changes
  useEffect(() => {
    if (selectedClass) {
      getAdminChapters(selectedClass as number).then(setChapters);
      setSelectedChapter('');
      setSelectedTopic('');
      setTopics([]);
    }
  }, [selectedClass]);

  // Load topics when chapter changes
  useEffect(() => {
    if (selectedChapter) {
      getAdminTopics(selectedChapter).then(setTopics);
      setSelectedTopic('');
    }
  }, [selectedChapter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a valid PDF file');
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedClass || !selectedChapter || !selectedTopic) {
      setError('Please select all fields and upload a PDF file');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      formData.append('classId', selectedClass.toString());
      formData.append('chapterId', selectedChapter);
      formData.append('topicId', selectedTopic);
      formData.append('provider', provider);

      const response = await fetch('http://localhost:3001/api/admin/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setError(err.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: colors.inputBg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: '0.4rem',
    padding: '0.5rem 0.7rem',
    fontFamily: font,
    fontSize: '0.9rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    color: colors.text,
    fontWeight: 600,
    fontSize: '0.85rem',
  };

  return (
    <div style={{ fontFamily: font, color: colors.text }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>PDF Upload & Extraction</h2>
        <p style={{ margin: 0, color: colors.sub, fontSize: '0.9rem' }}>
          Upload a PDF with questions and answers to automatically extract and save them to the database
        </p>
      </div>

      {/* Form */}
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '600px',
        }}
      >
        {/* Class Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>শ্রেণী (Class) *</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value ? parseInt(e.target.value) : '')}
            style={inputStyle}
          >
            <option value="">Select Class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.bengaliName} - {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chapter Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>অধ্যায় (Chapter) *</label>
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            style={inputStyle}
            disabled={!selectedClass}
          >
            <option value="">Select Chapter</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* Topic Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>বিষয় (Topic) *</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            style={inputStyle}
            disabled={!selectedChapter}
          >
            <option value="">Select Topic</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>

        {/* AI Provider Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>AI Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={inputStyle}>
            <option value="anthropic">Anthropic Claude</option>
            <option value="google">Google Gemini</option>
            <option value="openai">OpenAI GPT-4</option>
          </select>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: colors.sub }}>
            Make sure the corresponding API key is configured in the environment
          </p>
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>PDF File *</label>
          <input
            id="pdf-file-input"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{
              ...inputStyle,
              padding: '0.5rem',
              cursor: 'pointer',
            }}
          />
          {selectedFile && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: colors.success }}>
              ✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              background: `${colors.danger}15`,
              border: `1px solid ${colors.danger}`,
              borderRadius: '0.4rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: colors.danger,
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div
            style={{
              background: `${colors.success}15`,
              border: `1px solid ${colors.success}`,
              borderRadius: '0.4rem',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0', color: colors.success }}>✓ Upload Successful!</h4>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: colors.text }}>
              <strong>Extracted:</strong> {result.extracted} questions
            </p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: colors.text }}>
              <strong>Saved:</strong> {result.saved} questions
            </p>
            {result.message && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: colors.sub }}>
                {result.message}
              </p>
            )}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile || !selectedClass || !selectedChapter || !selectedTopic}
          style={btn(
            colors.primary,
            '#fff',
            uploading || !selectedFile || !selectedClass || !selectedChapter || !selectedTopic
          )}
        >
          {uploading ? 'Processing PDF...' : 'Upload & Extract Questions'}
        </button>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: `${colors.primary}10`,
          border: `1px solid ${colors.primary}40`,
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
          color: colors.text,
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem 0', color: colors.primary }}>📖 How it works:</h4>
        <ol style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
          <li>Select the class, chapter, and topic where questions should be saved</li>
          <li>Choose your preferred AI provider (requires API key configured)</li>
          <li>Upload a PDF containing Bengali math questions and answers</li>
          <li>The system will extract questions, translate them, and save to database</li>
        </ol>
      </div>
    </div>
  );
}
