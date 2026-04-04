'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usersApi, twoFactorApi } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  mfaPending: boolean;
  getToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<{ requiresMfa: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<{ requiresMfa: boolean }>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  verifyMfa: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const getToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  // After firebase auth, check if 2FA is required
  const checkMfa = async (): Promise<boolean> => {
    try {
      const profile = await usersApi.me();
      if (profile.totpEnabled) {
        setMfaPending(true);
        return true;
      }
    } catch {
      // ignore — user may not have a profile yet
    }
    return false;
  };

  const signInWithGoogle = async (): Promise<{ requiresMfa: boolean }> => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    const requiresMfa = await checkMfa();
    return { requiresMfa };
  };

  const signInWithEmail = async (email: string, password: string): Promise<{ requiresMfa: boolean }> => {
    await signInWithEmailAndPassword(auth, email, password);
    const requiresMfa = await checkMfa();
    return { requiresMfa };
  };

  const signUpWithEmail = async (email: string, password: string): Promise<void> => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const verifyMfa = async (token: string): Promise<void> => {
    await twoFactorApi.verify({ token });
    setMfaPending(false);
  };

  const signOut = async () => {
    setMfaPending(false);
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, mfaPending,
      getToken, signInWithGoogle, signInWithEmail, signUpWithEmail,
      verifyMfa, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
