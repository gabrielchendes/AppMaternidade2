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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Initial session check error:', error);
        // If there's an error getting the session (like invalid refresh token),
        // we MUST clear the state to prevent a lock-out or infinite error loops
        if (
          error.message?.includes('Refresh Token Not Found') || 
          error.message?.includes('Invalid Refresh Token') ||
          error.message?.includes('session_not_found') ||
          (error as any).status === 401
        ) {
          console.warn('Stale session detected, clearing...');
          // Use a more aggressive approach to clear storage if signOut fails
          supabase.auth.signOut().finally(() => {
            // Manually clear if needed as a fallback
            try {
              localStorage.removeItem('maternidade_premium_auth');
              // Clear all supabase related items just in case
              Object.keys(localStorage).forEach(key => {
                if (key.includes('maternidade_premium_auth') || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
                  localStorage.removeItem(key);
                }
              });
            } catch (e) {}
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
      
      if (event === 'SIGNED_OUT' || (event as any) === 'USER_DELETED') {
        setUser(null);
        setAuthLoading(false);
        // Clear hash to ensure next login starts at home
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
      }

      // Handle potential refresh errors that might manifest asynchronously
      setUser(session?.user ?? null);
      setAuthLoading(false);
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
