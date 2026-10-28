import { useEffect, useRef, useState } from 'react';
import { SpeakerIcon } from './Icons';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type PronunciationButtonProps = {
  word: string;
  className?: string;
};

export default function PronunciationButton({ word, className = '' }: PronunciationButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  async function pronounce() {
    if (!word.trim() || speaking) return;
    setError('');
    setSpeaking(true);
    try {
      const response = await fetch(`${API_BASE}/pronunciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? 'Could not generate pronunciation.');
      }
      audioRef.current?.pause();
      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setError('Could not play the pronunciation.');
        setSpeaking(false);
      };
      await audio.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate pronunciation.');
      setSpeaking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={pronounce}
      aria-label={error || `Hear ${word} pronounced`}
      title={error || 'Play pronunciation'}
      className={`grid h-8 w-8 place-items-center rounded-full text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 ${error ? 'text-red-600 hover:bg-red-50' : ''} ${className}`}
      disabled={speaking}
    >
      <SpeakerIcon className="h-4 w-4" />
    </button>
  );
}
