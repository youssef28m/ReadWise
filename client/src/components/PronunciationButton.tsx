import { useEffect, useRef, useState } from 'react';
import { SpeakerIcon } from './Icons';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

type PronunciationButtonProps = {
  word: string;
  night?: boolean;
  className?: string;
};

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!synth) return Promise.resolve([]);
  const loaded = synth.getVoices();
  if (loaded.length > 0) return Promise.resolve(loaded);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, 1000);
  });
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const american = (voice: SpeechSynthesisVoice) =>
    /^en[-_]us$/i.test(voice.lang) || /(american|united states|\bus\b)/i.test(voice.name);
  const british = (voice: SpeechSynthesisVoice) =>
    /^en[-_]gb$/i.test(voice.lang) || /(british|united kingdom|\buk\b|\bgb\b)/i.test(voice.name);
  return english.find(american) ?? english.find(british) ?? english[0];
}

async function speakWithWebSpeech(word: string) {
  if (!synth) throw new Error('Speech is not supported in this browser.');
  const voice = pickEnglishVoice(await waitForVoices());
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = voice?.lang ?? 'en-US';
  if (voice) utterance.voice = voice;
  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      reject(new Error(event.error === 'not-allowed' ? 'Your browser blocked the audio. Try again.' : 'Could not play the pronunciation.'));
    };
    synth.speak(utterance);
  });
}

export default function PronunciationButton({ word, night = false, className = '' }: PronunciationButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    audioRef.current?.pause();
    synth?.cancel();
  }, []);

  async function playRecording() {
    const response = await fetch(`${API_BASE}/pronunciation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word })
    });
    if (!response.ok) throw new Error('recording_unavailable');
    const audioUrl = URL.createObjectURL(await response.blob());
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Could not play the pronunciation.'));
        audio.play().catch(() => reject(new Error('Could not play the pronunciation.')));
      });
    } finally {
      URL.revokeObjectURL(audioUrl);
      if (audioRef.current === audio) audioRef.current = null;
    }
  }

  async function pronounce() {
    if (!word.trim() || speaking) return;
    setError('');
    setSpeaking(true);
    audioRef.current?.pause();
    synth?.cancel();
    try {
      try {
        await playRecording();
      } catch {
        await speakWithWebSpeech(word);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate pronunciation.');
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={pronounce}
      aria-label={error || `Hear ${word} pronounced`}
      title={error || 'Play pronunciation'}
      className={`grid h-8 w-8 place-items-center rounded-full transition disabled:opacity-50 ${
        error
          ? night
            ? 'text-red-400 hover:bg-red-500/15'
            : 'text-red-600 hover:bg-red-50'
          : night
            ? 'text-amber-400 hover:bg-amber-500/15'
            : 'text-amber-700 hover:bg-amber-100'
      } ${className}`}
      disabled={speaking}
    >
      <SpeakerIcon className="h-4 w-4" />
    </button>
  );
}
