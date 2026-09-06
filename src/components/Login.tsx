import { useState } from 'react';
import { auth, signInWithPopup, signInAnonymously, googleProvider } from '../lib/firebase';
import { LogIn, BookHeart, UserCheck, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState('');
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    setUnauthorizedDomain(false);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onLogin({
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
      });
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(true);
        setError('Domain localhost is not authorized in Firebase Auth.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    setError('');
    try {
      const result = await signInAnonymously(auth);
      onLogin({
        uid: result.user.uid,
        displayName: 'Guest Journaler',
        email: null,
        photoURL: null,
      });
    } catch (err: any) {
      console.warn("Firebase Anonymous Auth Error, falling back to local guest session:", err);
      // Local fallback session
      onLogin({
        uid: 'guest_' + Math.random().toString(36).substring(2, 9),
        displayName: 'Guest Journaler',
        email: null,
        photoURL: null,
      });
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-[#F2F0E9] rounded-3xl shadow-sm border border-[#D9D5C7] p-8 text-center space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-[#6B705C] rounded-full flex items-center justify-center text-white">
            <BookHeart size={32} />
          </div>
          <h1 className="text-3xl font-serif italic tracking-tight text-[#3D405B]">Mindful Journal</h1>
          <p className="text-[#A5A58D] text-lg">
            Reflect on your thoughts with an AI companion.
          </p>
        </div>

        {unauthorizedDomain && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs text-left space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertCircle size={16} />
              <span>Firebase Domain Not Authorized</span>
            </div>
            <p>
              Google Sign-In requires adding <strong>localhost</strong> to <em>Authorized Domains</em> in Firebase Console under Authentication settings.
            </p>
            <p className="font-semibold text-stone-700">
              👉 You can click <strong>Continue as Guest</strong> below to try all features locally right now!
            </p>
          </div>
        )}

        {error && !unauthorizedDomain && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGuestLoading}
            className="w-full flex items-center justify-center gap-3 bg-[#6B705C] hover:bg-[#585c4c] text-white rounded-2xl py-4 font-bold shadow-sm transition-colors disabled:opacity-70"
          >
            <LogIn size={20} />
            <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <button
            onClick={handleGuestSignIn}
            disabled={isLoading || isGuestLoading}
            className="w-full flex items-center justify-center gap-3 bg-[#E5EADF] hover:bg-[#D1D8C9] text-[#3D405B] border border-[#D1D8C9] rounded-2xl py-3.5 font-semibold transition-colors disabled:opacity-70"
          >
            <UserCheck size={20} className="text-[#6B705C]" />
            <span>{isGuestLoading ? 'Entering Guest Session...' : 'Continue as Guest (Demo Mode)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

