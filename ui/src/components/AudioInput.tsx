import { useState, useRef, type CSSProperties } from 'react';

interface Props {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export default function AudioInput({ onTranscribed, disabled }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  const activeColor = '#3b82f6';
  const recordingColor = '#ef4444';
  const processingColor = '#f59e0b';

  async function startRecording() {
    if (isRecording || isProcessing || disabled) return;

    // Try Web Speech API first
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'bn-BD'; // Bengali (Bangladesh)
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onstart = () => {
          setIsRecording(true);
        };

        recognitionRef.current.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            onTranscribed(transcript + ' ');
          }
          setIsRecording(false);
        };

        recognitionRef.current.onerror = () => {
          setIsRecording(false);
          // Fall back to audio recording
          fallbackToAudioRecording();
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current.start();
      } catch (err) {
        console.error('SpeechRecognition error:', err);
        fallbackToAudioRecording();
      }
    } else {
      fallbackToAudioRecording();
    }
  }

  async function fallbackToAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        setIsProcessing(false);
        // Stop audio tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Fallback recording error:', err);
      alert('বর্তমানে মাইক্রোফোন অ্যাক্সেস উপলব্ধ নয়। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  }

  async function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(audioBlob: Blob) {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        const response = await fetch('http://localhost:3001/api/audio/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Audio,
            mimeType: 'audio/webm',
          }),
        });

        const data = await response.json();
        if (data.text) {
          onTranscribed(data.text + ' ');
        } else if (data.error) {
          alert('অডিও প্রক্রিয়াকরণে সমস্যা: ' + data.error);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error('Transcription error:', err);
      alert('অডিও ট্রান্সক্রিপশনে ত্রুটি হয়েছে');
    }
  }

  const buttonStyle: CSSProperties = {
    padding: '0.5rem 0.8rem',
    background: isRecording ? recordingColor : isProcessing ? processingColor : activeColor,
    color: 'white',
    border: 'none',
    borderRadius: '0.6rem',
    cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
    fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
    animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none',
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        style={buttonStyle}
        title={isRecording ? 'রেকর্ডিং বন্ধ করুন' : 'মাইক্রোফোন দিয়ে বলুন'}
      >
        {isProcessing ? '⏳ প্রক্রিয়াধীন...' : isRecording ? '🎤 রেকর্ড হচ্ছে...' : '🎤 বলুন'}
      </button>
    </>
  );
}
