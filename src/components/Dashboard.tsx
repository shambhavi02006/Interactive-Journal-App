import { useState, useEffect, useRef } from 'react';
import { User, JournalEntry, ChatMessage } from '../types';
import { auth, db, signOut } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { LogOut, Plus, MessageSquare, Send, Loader2, Book, BookHeart, Music, Edit2, Check, Sparkles, SmilePlus } from 'lucide-react';
import MusicPlayer from './MusicPlayer';
import MoodSelector from './MoodSelector';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSuggestingMusic, setIsSuggestingMusic] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'users', user.uid, 'entries'),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedEntries: JournalEntry[] = [];
        snapshot.forEach((doc) => {
          loadedEntries.push({ id: doc.id, ...doc.data() } as JournalEntry);
        });
        if (loadedEntries.length > 0) {
          setEntries(loadedEntries);
        }
      }, (err) => {
        console.warn("Firestore snapshot listener error (using local state fallback):", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore listener init error:", e);
    }
  }, [user.uid]);

  // Keep current entry synced with Firestore updates
  useEffect(() => {
    if (currentEntry) {
      const updated = entries.find(e => e.id === currentEntry.id);
      if (updated && (updated.messages.length !== currentEntry.messages.length || updated.title !== currentEntry.title)) {
        setCurrentEntry(updated);
      }
    }
  }, [entries]);

  // Keep scroll at bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentEntry?.messages, isTyping, showMoodSelector]);

  const handleLogout = async () => {
    try { await signOut(auth); } catch(e){}
    onLogout();
  };

  const safeFirestoreUpdate = async (entryId: string, data: any) => {
    try {
      if (entryId && !entryId.startsWith('temp_')) {
        await updateDoc(doc(db, 'users', user.uid, 'entries', entryId), data);
      }
    } catch (e) {
      console.warn("Firestore update notice (local state maintained):", e);
    }
  };

  const createNewEntry = async () => {
    const tempId = 'temp_' + Date.now();
    const newEntry: JournalEntry = {
      id: tempId,
      userId: user.uid,
      title: 'New Reflection',
      createdAt: Date.now(),
      messages: []
    };

    setCurrentEntry(newEntry);
    setEntries(prev => [newEntry, ...prev]);
    setShowMoodSelector(true);

    try {
      const newDoc = await addDoc(collection(db, 'users', user.uid, 'entries'), {
        userId: user.uid,
        title: 'New Reflection',
        createdAt: Date.now(),
        messages: []
      });
      const realEntry = { ...newEntry, id: newDoc.id };
      setCurrentEntry(realEntry);
      setEntries(prev => prev.map(e => e.id === tempId ? realEntry : e));
    } catch (e) {
      console.warn("Firestore addDoc fallback (running in local mode):", e);
    }
  };

  const sendMessage = async (overrideMessage?: string) => {
    const messageToSend = overrideMessage || inputText.trim();
    if (!messageToSend || !currentEntry) return;

    if (!overrideMessage) setInputText('');
    setShowMoodSelector(false);
    
    const userMessage: ChatMessage = { role: 'user', text: messageToSend };
    const updatedMessages = [...currentEntry.messages, userMessage];

    // Optimistically update UI
    setCurrentEntry({ ...currentEntry, messages: updatedMessages });
    setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, messages: updatedMessages } : e));

    safeFirestoreUpdate(currentEntry.id, { messages: updatedMessages });

    setIsTyping(true);

    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageToSend,
          history: currentEntry.messages
        })
      });

      if (!res.ok) throw new Error('API Error');
      
      const data = await res.json();
      const aiReply = data.reply || "Thank you for sharing your thoughts with me.";
      const detectedEmotion = data.detectedEmotion;
      const emotionEmoji = data.emotionEmoji;

      const aiMessage: ChatMessage = {
        role: 'model',
        text: aiReply,
        detectedEmotion,
        emotionEmoji
      };

      const finalMessages = [...updatedMessages, aiMessage];
      let newTitle = currentEntry.title;
      if (currentEntry.title === 'New Reflection' && data.suggestedTitle) {
        newTitle = data.suggestedTitle;
      }

      setCurrentEntry(prev => prev ? { ...prev, title: newTitle, messages: finalMessages } : prev);
      setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, title: newTitle, messages: finalMessages } : e));

      safeFirestoreUpdate(currentEntry.id, { title: newTitle, messages: finalMessages });

    } catch (err) {
      console.error("Chat API error:", err);
      const errorMessages = [...updatedMessages, {
        role: 'model',
        text: 'I am here with you. Please tell me more about what is on your mind.'
      } as ChatMessage];
      setCurrentEntry(prev => prev ? { ...prev, messages: errorMessages } : prev);
      setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, messages: errorMessages } : e));
    } finally {
      setIsTyping(false);
    }
  };

  const handleSelectMood = async (selectedMood: string) => {
    if (!currentEntry) return;

    setShowMoodSelector(false);
    setIsSuggestingMusic(true);

    const userMoodText = `I am feeling ${selectedMood} right now.`;
    const userMsg: ChatMessage = { role: 'user', text: userMoodText };
    const updatedMessages = [...currentEntry.messages, userMsg];

    setCurrentEntry({ ...currentEntry, messages: updatedMessages });
    setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, messages: updatedMessages } : e));
    safeFirestoreUpdate(currentEntry.id, { messages: updatedMessages });

    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          history: currentEntry.messages,
          mood: selectedMood
        })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      let musicData = undefined;
      if (data.searchData) {
        try {
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(data.searchData.songName + ' ' + data.searchData.artistName)}&entity=song&limit=1`);
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            if (itunesData.results && itunesData.results.length > 0) {
              const track = itunesData.results[0];
              musicData = {
                previewUrl: track.previewUrl,
                trackName: track.trackName,
                artistName: track.artistName,
                artworkUrl: track.artworkUrl100
              };
            }
          }
        } catch (e) {
          console.error("iTunes fetch error", e);
        }
      }

      const aiMessage: ChatMessage = {
        role: 'model',
        text: data.reply,
        detectedEmotion: data.detectedEmotion || selectedMood,
        emotionEmoji: data.emotionEmoji || '🎵',
        musicData
      };

      const finalMessages = [...updatedMessages, aiMessage];
      const newTitle = currentEntry.title === 'New Reflection' ? `${selectedMood} Mood Reflection` : currentEntry.title;

      setCurrentEntry(prev => prev ? { ...prev, title: newTitle, messages: finalMessages } : prev);
      setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, title: newTitle, messages: finalMessages } : e));
      safeFirestoreUpdate(currentEntry.id, { title: newTitle, messages: finalMessages });

    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        role: 'model',
        text: `I noticed you're feeling ${selectedMood}. Take a deep breath. Would you like to write more about why you feel this way?`,
        detectedEmotion: selectedMood,
        emotionEmoji: '💙'
      };
      const finalMessages = [...updatedMessages, errorMsg];
      setCurrentEntry(prev => prev ? { ...prev, messages: finalMessages } : prev);
      setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, messages: finalMessages } : e));
    } finally {
      setIsSuggestingMusic(false);
    }
  };

  const suggestMusic = async () => {
    if (!currentEntry) return;

    if (currentEntry.messages.length === 0) {
      setShowMoodSelector(true);
      return;
    }

    setIsSuggestingMusic(true);
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history: currentEntry.messages })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      let musicData = undefined;
      if (data.searchData) {
        try {
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(data.searchData.songName + ' ' + data.searchData.artistName)}&entity=song&limit=1`);
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            if (itunesData.results && itunesData.results.length > 0) {
              const track = itunesData.results[0];
              musicData = {
                previewUrl: track.previewUrl,
                trackName: track.trackName,
                artistName: track.artistName,
                artworkUrl: track.artworkUrl100
              };
            }
          }
        } catch (e) {
          console.error("iTunes fetch error", e);
        }
      }

      const aiMsg: ChatMessage = {
        role: 'model',
        text: data.reply,
        detectedEmotion: data.detectedEmotion,
        emotionEmoji: data.emotionEmoji,
        musicData
      };

      const finalMessages = [...currentEntry.messages, aiMsg];
      setCurrentEntry(prev => prev ? { ...prev, messages: finalMessages } : prev);
      setEntries(prev => prev.map(e => e.id === currentEntry.id ? { ...e, messages: finalMessages } : e));
      safeFirestoreUpdate(currentEntry.id, { messages: finalMessages });
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = { role: 'model', text: 'Sorry, I could not fetch a music suggestion right now.' };
      const finalMessages = [...currentEntry.messages, errorMsg];
      setCurrentEntry(prev => prev ? { ...prev, messages: finalMessages } : prev);
    } finally {
      setIsSuggestingMusic(false);
    }
  };

  const handleSaveTitle = async () => {
    if (currentEntry && editTitleValue.trim() !== '') {
      const newTitle = editTitleValue.trim();
      const updatedEntry = { ...currentEntry, title: newTitle };
      setCurrentEntry(updatedEntry);
      setEntries(prev => prev.map(e => e.id === currentEntry.id ? updatedEntry : e));
      safeFirestoreUpdate(currentEntry.id, { title: newTitle });
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex h-screen bg-[#FDFBF7] text-[#3D405B] font-sans">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} flex-shrink-0 transition-all duration-300 overflow-hidden bg-[#F2F0E9] border-r border-[#D9D5C7] flex flex-col`}>
        <div className="p-6 bg-[#EBE8DF] border-b border-[#D9D5C7] flex justify-between items-center">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-[#D9D5C7]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#B7B7A4] flex items-center justify-center text-white text-xs uppercase">
                <span>{user.displayName?.charAt(0) || 'U'}</span>
              </div>
            )}
            <div className="truncate">
              <p className="font-bold text-[#3D405B] text-xs truncate">{user.displayName}</p>
              <button onClick={handleLogout} className="text-[10px] text-[#A5A58D] hover:text-[#3D405B] flex items-center gap-1 mt-0.5 transition-colors">
                <LogOut size={10} /> Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <button
            onClick={createNewEntry}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#6B705C] text-white rounded-xl hover:bg-[#585c4c] shadow-sm transition-all mb-6"
          >
            <Plus size={18} />
            <span className="font-bold text-xs">New Reflection</span>
          </button>

          <h3 className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-[0.2em] px-3 py-4">Recent Reflections</h3>
          {entries.length === 0 ? (
            <p className="text-[#A5A58D] text-sm px-3 italic">No entries yet.</p>
          ) : (
            entries.map(entry => (
              <button
                key={entry.id}
                onClick={() => { setCurrentEntry(entry); setShowMoodSelector(false); }}
                className={`w-full text-left p-3 rounded-xl transition-colors flex items-start gap-3 ${
                  currentEntry?.id === entry.id
                    ? 'bg-[#E5EADF] border border-[#D1D8C9] text-[#3D405B]'
                    : 'hover:bg-[#EAE8DD] text-[#3D405B]'
                }`}
              >
                <div className={`mt-0.5 ${currentEntry?.id === entry.id ? 'text-[#6B705C]' : 'text-[#A5A58D]'}`}>
                  <Book size={16} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-medium text-sm truncate">{entry.title}</h4>
                  <p className={`text-xs mt-1 ${currentEntry?.id === entry.id ? 'text-[#6B705C] italic' : 'text-[#A5A58D]'}`}>{format(entry.createdAt, 'MMM d, yyyy')}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative bg-[#FDFBF7]">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 p-2 bg-white rounded-lg shadow-sm border border-[#E6E2D6] text-[#3D405B] hover:bg-[#EAE8DD] z-10"
          >
            <MessageSquare size={20} />
          </button>
        )}
        {isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 left-4 p-2 text-[#A5A58D] hover:text-[#3D405B] z-10 lg:hidden"
          >
            <MessageSquare size={20} />
          </button>
        )}

        {currentEntry ? (
          <>
            <header className="h-20 border-b border-[#E6E2D6] px-8 flex items-center justify-between shrink-0">
              <div className="pl-8 lg:pl-0 flex items-center gap-3 w-full max-w-xl">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); }}
                      className="text-xl font-serif italic bg-transparent border-b border-[#A5A58D] focus:outline-none focus:border-[#6B705C] px-1 py-1 w-full text-[#3D405B]"
                      autoFocus
                    />
                    <button onClick={handleSaveTitle} className="text-[#6B705C] hover:text-[#585c4c] p-1">
                      <Check size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h2 className="text-xl font-serif italic truncate">{currentEntry.title}</h2>
                    <button 
                      onClick={() => { setEditTitleValue(currentEntry.title); setIsEditingTitle(true); }}
                      className="text-[#A5A58D] hover:text-[#6B705C] opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#A5A58D] uppercase tracking-widest hidden md:block shrink-0">
                {format(currentEntry.createdAt, 'MMM d, yyyy')}
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
              <div className="max-w-3xl mx-auto space-y-6 pb-32">
                {/* Empty State / How are you feeling prompt */}
                {currentEntry.messages.length === 0 && !showMoodSelector && (
                  <div className="bg-[#F2F0E9] border border-[#D9D5C7] rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4 my-8">
                    <div className="w-12 h-12 bg-[#6B705C] rounded-full flex items-center justify-center text-white mx-auto">
                      <Sparkles size={24} />
                    </div>
                    <h3 className="text-2xl font-serif italic text-[#3D405B]">Welcome to your Reflection</h3>
                    <p className="text-[#A5A58D] text-sm">
                      Tell me about your day, your feelings, or what’s on your mind. Aether is here to listen, analyze your emotions, and curate matching music for you.
                    </p>
                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        onClick={() => setShowMoodSelector(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#6B705C] text-white rounded-2xl text-xs font-semibold shadow-sm hover:bg-[#585c4c] transition-all"
                      >
                        <SmilePlus size={16} />
                        <span>Select My Current Mood</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mood Selector Component */}
                {showMoodSelector && (
                  <MoodSelector onSelectMood={handleSelectMood} isLoading={isSuggestingMusic || isTyping} />
                )}

                {/* Chat Messages */}
                {currentEntry.messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 max-w-xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex-none flex items-center justify-center text-[10px] font-bold text-white ${
                      msg.role === 'user' ? 'bg-[#6B705C]' : 'bg-[#B7B7A4]'
                    }`}>
                      {msg.role === 'user' ? (user.displayName?.charAt(0) || 'U') : 'A'}
                    </div>

                    <div className="space-y-2 max-w-md">
                      {/* Detected Emotion Badge */}
                      {msg.role === 'model' && msg.detectedEmotion && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5EADF] text-[#6B705C] text-xs font-medium border border-[#D1D8C9]">
                          <span>{msg.emotionEmoji || '✨'}</span>
                          <span>Emotion Detected: <strong>{msg.detectedEmotion}</strong></span>
                        </div>
                      )}

                      <div className={`p-4 rounded-2xl shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#E5EADF] border border-[#D1D8C9]' 
                          : 'bg-white border border-[#E6E2D6]'
                      }`}>
                        <div className="text-sm leading-relaxed text-[#3D405B]">
                          {msg.role === 'model' ? (
                            <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                          ) : (
                            msg.text
                          )}
                          {msg.musicData && (
                            <MusicPlayer 
                              trackName={msg.musicData.trackName}
                              artistName={msg.musicData.artistName}
                              previewUrl={msg.musicData.previewUrl}
                              artworkUrl={msg.musicData.artworkUrl}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(isTyping || isSuggestingMusic) && (
                  <div className="flex gap-4 max-w-lg">
                     <div className="w-8 h-8 rounded-full bg-[#B7B7A4] flex-none flex items-center justify-center text-[10px] text-white">
                        A
                     </div>
                     <div className="bg-white border border-[#E6E2D6] p-4 rounded-2xl shadow-sm flex items-center gap-3">
                        <Loader2 size={16} className="animate-spin text-[#6B705C]" />
                        <span className="text-xs text-[#A5A58D] italic">
                          {isSuggestingMusic ? 'Analyzing mood & finding matching music...' : 'Aether is listening & reflecting...'}
                        </span>
                     </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-6 bg-[#FDFBF7] border-t border-[#E6E2D6]">
              <div className="max-w-xl mx-auto">
                <div className="flex items-center gap-2 bg-white border border-[#D9D5C7] rounded-2xl p-2 shadow-sm">
                  <button
                    onClick={() => setShowMoodSelector(!showMoodSelector)}
                    className={`p-2.5 rounded-xl transition-colors ${showMoodSelector ? 'bg-[#6B705C] text-white' : 'bg-[#F2F0E9] text-[#6B705C] hover:bg-[#E5EADF]'}`}
                    title="Choose your current mood"
                  >
                    <SmilePlus size={18} />
                  </button>

                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Tell me about your day, emotions, or thoughts..."
                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-[#3D405B] placeholder-[#A5A58D] resize-none max-h-[120px]"
                    rows={1}
                  />

                  <button
                    onClick={suggestMusic}
                    disabled={isTyping || isSuggestingMusic}
                    className="p-3 bg-[#E5EADF] text-[#6B705C] rounded-xl shadow-sm hover:bg-[#D1D8C9] transition-colors disabled:opacity-50"
                    title="Suggest a song matching my mood"
                  >
                    {isSuggestingMusic ? <Loader2 size={16} className="animate-spin" /> : <Music size={16} />}
                  </button>

                  <button
                    onClick={() => sendMessage()}
                    disabled={!inputText.trim() || isTyping}
                    className="p-3 bg-[#6B705C] text-white rounded-xl shadow-lg hover:bg-[#585c4c] transition-colors disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <p className="text-center mt-2.5 text-[10px] text-[#A5A58D] font-medium">Interactive AI Emotion Analysis & Mood-Matched Music</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-[#F2F0E9] rounded-full flex items-center justify-center text-[#B7B7A4] mb-6 border border-[#D9D5C7]">
              <BookHeart size={40} />
            </div>
            <h2 className="text-2xl font-serif italic text-[#3D405B] mb-3">Your Mindful Space</h2>
            <p className="text-[#A5A58D] max-w-md">
              Select an entry from the sidebar or start a new reflection to begin conversing with Aether.
            </p>
            <button
              onClick={createNewEntry}
              className="mt-8 px-6 py-3 bg-[#6B705C] text-white rounded-xl font-bold shadow-sm hover:bg-[#585c4c] transition-colors"
            >
              Start New Reflection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
