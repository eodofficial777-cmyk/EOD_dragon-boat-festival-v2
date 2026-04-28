import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBZBMt01ReXfARPI3XUbK5vJXCEEdoFnTA",
  authDomain: "eod-dragonboatfestival.firebaseapp.com",
  databaseURL: "https://eod-dragonboatfestival-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eod-dragonboatfestival",
  storageBucket: "eod-dragonboatfestival.firebasestorage.app",
  messagingSenderId: "359130519003",
  appId: "1:359130519003:web:e454942adcc1757e37c3fe"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
