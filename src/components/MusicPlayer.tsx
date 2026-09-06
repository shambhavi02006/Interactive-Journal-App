import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface MusicPlayerProps {
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl?: string;
}

export default function MusicPlayer({ trackName, artistName, previewUrl, artworkUrl }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(previewUrl);
    audioRef.current = audio;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [previewUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = (Number(e.target.value) / 100) * (audioRef.current.duration || 30);
    audioRef.current.currentTime = newTime;
    setProgress(Number(e.target.value));
  };

  return (
    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-[#E6E2D6] shadow-sm max-w-sm mt-3">
      {artworkUrl && (
        <img src={artworkUrl} alt={trackName} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
      )}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="truncate">
          <p className="text-sm font-bold text-[#3D405B] truncate">{trackName}</p>
          <p className="text-xs text-[#A5A58D] truncate">{artistName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={togglePlay}
            className="w-6 h-6 flex items-center justify-center bg-[#6B705C] text-white rounded-full hover:bg-[#585c4c] transition-colors shrink-0"
          >
            {isPlaying ? <Pause size={12} className="ml-0" /> : <Play size={12} className="ml-0.5" />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={progress || 0}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-[#E6E2D6] rounded-full appearance-none cursor-pointer accent-[#6B705C]"
          />
        </div>
      </div>
    </div>
  );
}
