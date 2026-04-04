import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Helper function to remove accents from string
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Helper function to generate email from name
function generateEmail(firstName: string, lastName: string): string {
  const cleanFirstName = removeAccents(firstName.toLowerCase().trim());
  const cleanLastName = removeAccents(lastName.toLowerCase().trim().replace(/\s+/g, ''));
  return `${cleanFirstName}.${cleanLastName}@nexus.local`;
}

interface User {
  id: string;
  email: string;
  user_metadata: {
    firstName: string;
    lastName: string;
    displayName: string;
  };
}

export interface UserProfile {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  username?: string;
  bio: string;
  avatar: string;
  banner: string;
  cpf: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  userProfile: UserProfile | null;
  signIn: (fullName: string, cpf: string) => Promise<void>;
  signUp: (fullName: string, cpf: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (userId: string, attempt = 0) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const profile = await res.json();
        setUserProfile(profile);
      } else {
        console.warn(`User profile fetch returned ${res.status} for ${userId}`);
      }
    } catch (e: any) {
      if (attempt < 2) {
        // Retry after short delay (handles Edge Function cold-start)
        setTimeout(() => loadUserProfile(userId, attempt + 1), 2000 * (attempt + 1));
      } else {
        console.error('Error loading user profile after retries:', e?.message || e);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) await loadUserProfile(user.id);
  };

  // Always returns a fresh, valid access token by reading directly from the Supabase session
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  /**
   * Returns headers for authenticated API calls to the edge function.
   * - Authorization: anon key  → always accepted by the Supabase gateway
   * - X-User-Token: user JWT   → read by Hono for actual user identification
   */
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
      };
      if (session?.access_token) {
        headers['X-User-Token'] = session.access_token;
      }
      return headers;
    } catch {
      return { 'Authorization': `Bearer ${publicAnonKey}` };
    }
  };

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user as User);
          setAccessToken(session.access_token);
          await loadUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user as User);
        setAccessToken(session.access_token);
        await loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setAccessToken(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (fullName: string, cpf: string) => {
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ firstName, lastName, cpf }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to sign up');
    }

    await signIn(fullName, cpf);
  };

  const signIn = async (fullName: string, cpf: string) => {
    let email: string;

    // Support login with @username or plain username (no spaces = treat as username)
    const trimmed = fullName.trim();
    const isUsername = trimmed.startsWith('@') || !trimmed.includes(' ');

    if (isUsername) {
      // Lookup email by username via backend
      const lookupRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/auth/lookup-by-username`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ username: trimmed }),
        }
      );
      const lookupData = await lookupRes.json();
      if (!lookupRes.ok || !lookupData.email) {
        throw new Error('Usuário com esse @ não encontrado');
      }
      email = lookupData.email;
    } else {
      const nameParts = trimmed.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      email = generateEmail(firstName, lastName);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: cpf,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.session) {
      setUser(data.user as User);
      setAccessToken(data.session.access_token);
      await loadUserProfile(data.user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, userProfile, signIn, signUp, signOut, refreshProfile, getAccessToken, getAuthHeaders, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}