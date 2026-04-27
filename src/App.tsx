import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import { User } from '@supabase/supabase-js';
import { useSettings } from './contexts/SettingsContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { loading: settingsLoading } = useSettings();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        // If there's an error getting the session (like invalid refresh token),
        // try to sign out to clear any stale local state
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          supabase.auth.signOut().then(() => {
            setUser(null);
            setAuthLoading(false);
          });
          return;
        }
      }
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      // Handle the case where a refresh token error might occur during a background event
      if (event === 'SIGNED_OUT' || (event as any) === 'USER_DELETED') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (settingsLoading || authLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-white font-sans selection:bg-primary/30">
      {!user ? <LoginPage /> : <Dashboard user={user} />}
    </div>
  );
}
