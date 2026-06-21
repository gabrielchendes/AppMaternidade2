import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { useSettings } from './contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Main application component
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { settings, loading: settingsLoading } = useSettings();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    // Check current session
    const checkInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error.message);
          // If we have a refresh token error, we need to clear local state
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid_grant')) {
            console.warn('Handling stale session...');
            await supabase.auth.signOut();
            // Fallback: manually clear if signOut doesn't clean everything
            try {
              localStorage.removeItem('maternidade_premium_auth');
              // Clear any other supabase-related keys
              for (const key in localStorage) {
                if (key.includes('supabase') || key.includes('-auth-token') || key.includes('maternidade_premium')) {
                  localStorage.removeItem(key);
                }
              }
            } catch (e) {}
          }
          setUser(null);
          setAuthLoading(false);
          return;
        }

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
        setUser(null);
        setAuthLoading(false);
      }
    };

    checkInitialSession();

    // Absolute fallback to ensure we don't get stuck on loading screen
    const forceStopLoading = setTimeout(() => {
      setAuthLoading(false);
    }, 10000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth Event: ${event}`);
      
      if (session?.user) {
        setUser(session.user);
        setAuthLoading(false);
        clearTimeout(forceStopLoading);
      } else if (event === 'SIGNED_OUT' || (event as any) === 'USER_DELETED') {
        setUser(null);
        setAuthLoading(false);
        clearTimeout(forceStopLoading);
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(forceStopLoading);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [user]);

  // Google Analytics GA4 dynamic initialization
  useEffect(() => {
    const gaId = settings?.ga4_tag_id;
    if (!gaId) return;

    // Check if script already exists
    if (document.querySelector(`script[src*="gtag/js?id=${gaId}"]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    const initScript = document.createElement('script');
    initScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}', {
        page_path: window.location.pathname + window.location.hash,
      });
    `;
    document.head.appendChild(initScript);

    return () => {
      // We don't necessarily want to remove GA once loaded to avoid re-init issues, 
      // but clean up init script is fine.
      if (initScript.parentNode) document.head.removeChild(initScript);
    };
  }, [settings?.ga4_tag_id]);

  // Track hash changes (navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const gaId = settings?.ga4_tag_id;
      if (gaId && (window as any).gtag) {
        (window as any).gtag('config', gaId, {
          page_path: window.location.pathname + window.location.hash,
          page_title: document.title
        });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [settings?.ga4_tag_id]);

  if (settingsLoading || authLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-white font-sans selection:bg-primary/30 text-pretty">
      {!user ? (
          <Suspense fallback={
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <LoginPage />
          </Suspense>
      ) : (
          <Suspense fallback={
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <Dashboard user={user} />
          </Suspense>
      )}
    </div>
  );
}
