import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0935227418",
  appId: "1:241482625762:web:1b8699a16a5f1e0cece4bb",
  apiKey: "AIzaSyAJnSBuwjffr4MTA36HltqZSdic7ZKpQNg",
  authDomain: "gen-lang-client-0935227418.firebaseapp.com",
  storageBucket: "gen-lang-client-0935227418.firebasestorage.app",
  messagingSenderId: "241482625762",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-journalapp-edfaf991-62e1-42e6-9312-25ddbe475c57");
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signInAnonymously, signOut };

