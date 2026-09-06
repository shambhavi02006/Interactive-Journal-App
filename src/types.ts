export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  detectedEmotion?: string;
  emotionEmoji?: string;
  musicData?: {
    previewUrl?: string;
    trackName: string;
    artistName: string;
    artworkUrl?: string;
    explanation?: string;
  };
  isMoodPrompt?: boolean;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  primaryMood?: string;
}

