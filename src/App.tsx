import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { useSettings } from './contexts/SettingsContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const LoadingScreen = () => (
  <div className="min-h-screen bg-bg-main flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

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
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setAuthLoading(false);
        } else {
          // If no session, only stop loading if we are NOT in the middle of a hash login
          if (!window.location.hash.includes('access_token=')) {
            setAuthLoading(false);
          } else {
            console.log('Detected hash fragment, keeping loading state for processing...');
            // Safety timeout: if after 5 seconds nothing happened, stop loading
            setTimeout(() => setAuthLoading(false), 5000);
          }
        }
      } catch (error) {
        console.error('Initial session check error:', error);
        setAuthLoading(false);
      }
    };

    checkInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth Event: ${event}`);
      
      if (session?.user) {
        setUser(session.user);
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT' || (event as any) === 'USER_DELETED') {
        setUser(null);
        setAuthLoading(false);
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [user]);

  if (settingsLoading || authLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-bg-main text-white font-sans selection:bg-primary/30 text-pretty">
      <Suspense fallback={<LoadingScreen />}>
        {!user ? <LoginPage /> : <Dashboard user={user} />}
      </Suspense>
    </div>
  );
}
