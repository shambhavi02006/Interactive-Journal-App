import React, { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';

interface MoodSelectorProps {
  onSelectMood: (mood: string) => void;
  isLoading?: boolean;
}

const PRESET_MOODS = [
  { label: 'Sad', emoji: '😔', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { label: 'Angry', emoji: '😠', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { label: 'Happy', emoji: '😊', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { label: 'Anxious', emoji: '😟', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { label: 'Nervous', emoji: '😬', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
];

const RANDOM_MOODS = [
  { label: 'Nostalgic', emoji: '📻' },
  { label: 'Serene', emoji: '🌊' },
  { label: 'Exhausted', emoji: '🔋' },
  { label: 'Hopeful', emoji: '🌱' },
  { label: 'Overwhelmed', emoji: '🌀' },
  { label: 'ECSTATIC', emoji: '✨' },
];

export default function MoodSelector({ onSelectMood, isLoading }: MoodSelectorProps) {
  const [customMood, setCustomMood] = useState('');

  const handleRandomClick = () => {
    const randomItem = RANDOM_MOODS[Math.floor(Math.random() * RANDOM_MOODS.length)];
    onSelectMood(randomItem.label);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customMood.trim()) {
      onSelectMood(customMood.trim());
      setCustomMood('');
    }
  };

  return (
    <div className="bg-white border border-[#E6E2D6] rounded-2xl p-6 shadow-sm my-4 space-y-4 max-w-xl mx-auto animate-fade-in">
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-[#6B705C]" />
        <h3 className="font-serif italic text-lg text-[#3D405B] font-semibold">How are you feeling right now?</h3>
      </div>
      <p className="text-xs text-[#A5A58D]">
        Select your current emotion or type your own to receive personalized reflections and music:
      </p>

      {/* Preset Mood Chips */}
      <div className="flex flex-wrap gap-2 pt-1">
        {PRESET_MOODS.map((m) => (
          <button
            key={m.label}
            disabled={isLoading}
            onClick={() => onSelectMood(m.label)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${m.color} disabled:opacity-50`}
          >
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}

        {/* Random / Surprise Me Chip */}
        <button
          disabled={isLoading}
          onClick={handleRandomClick}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all disabled:opacity-50"
        >
          <span>🎲</span>
          <span>Surprise Me (Random)</span>
        </button>
      </div>

      {/* Write your own emotion input */}
      <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-2 border-t border-[#F2F0E9]">
        <input
          type="text"
          value={customMood}
          onChange={(e) => setCustomMood(e.target.value)}
          placeholder="Write your own emotion (e.g. nostalgic, peaceful)..."
          disabled={isLoading}
          className="flex-1 bg-[#FDFBF7] border border-[#D9D5C7] rounded-xl px-3 py-2 text-xs text-[#3D405B] placeholder-[#A5A58D] outline-none focus:border-[#6B705C]"
        />
        <button
          type="submit"
          disabled={!customMood.trim() || isLoading}
          className="px-4 py-2 bg-[#6B705C] hover:bg-[#585c4c] text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <span>Submit</span>
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
