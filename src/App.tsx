import { useState, useEffect, Suspense } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { useSettings } from './contexts/SettingsContext';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { safeFetch } from './lib/utils';
import { toast } from 'sonner';
import LoginPage from './pages/LoginPage';
import { GlowingSpinner } from './components/GlowingSpinner';

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));

// Smooth hardware-accelerated Loading Screen
function LoadingScreen() {
  return <GlowingSpinner fullScreen size="lg" />;
}

// Main application component
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { settings, loading: settingsLoading } = useSettings();

  useEffect(() => {
    // Clear chunk-failed-reload flag since the app is mounting successfully
    try {
      sessionStorage.removeItem('chunk-failed-reload');
    } catch (e) {}

    // Global listener for unhandled token refresh/Supabase API rejections and transient network errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorMsg = reason?.message || String(reason || '');
      const isAuthError = 
        errorMsg.includes('Refresh Token Not Found') || 
        errorMsg.includes('Invalid Refresh Token') ||
        errorMsg.includes('invalid_grant') || 
        errorMsg.includes('AuthApiError') ||
        errorMsg.includes('AuthSessionMissingError') ||
        errorMsg.includes('session_not_found') ||
        errorMsg.includes('refresh_token_not_found');

      if (isAuthError) {
        console.warn('Caught unhandled auth rejection smoothly, cleaning up auth state...', errorMsg);
        try {
          event.preventDefault();
        } catch (e) {}
        try {
          localStorage.removeItem('maternidade_premium_auth');
          for (const key in localStorage) {
            if (key.includes('supabase') || key.includes('-auth-token') || key.includes('maternidade_premium')) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {}
        if (isSupabaseConfigured && supabase) {
          supabase.auth.signOut().catch(() => {});
        }
        setUser(null);
        setAuthLoading(false);
      } else if (
        errorMsg.includes('NetworkError') ||
        errorMsg.includes('fetch resource') ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('Load failed')
      ) {
        console.warn('⚠️ Intercepted transient background NetworkError gracefully:', errorMsg);
        try {
          event.preventDefault();
        } catch (e) {}
      }
    };

    // Global onerror handler to suppress and gracefully intercept cross-origin and network exceptions
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || '';
      const source = event.filename || '';
      const isCrossOriginOrChunk = 
        msg.includes('Script error') || 
        msg.toLowerCase().includes('script error') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('NetworkError') ||
        msg.includes('fetch resource') ||
        msg.includes('Failed to fetch') ||
        msg.includes('Load failed') ||
        !msg || // Empty error message
        (source && (source.includes('gtag') || source.includes('googletagmanager') || source.includes('supabase') || source.includes('pwa')));

      if (isCrossOriginOrChunk) {
        console.warn('⚠️ Intercepted cross-origin, chunk or network error gracefully:', msg, 'from:', source);
        try {
          event.preventDefault();
          event.stopPropagation();
        } catch (e) {}
        return true; // Stop error from bubbling and triggering parent iframe warnings
      }
      return false;
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    // Check current session
    const checkInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Session check note:', error.message);
          // If we have a refresh token error, we need to clear local state
          if (error.message.includes('Refresh Token') || error.message.includes('invalid_grant') || error.message.includes('Invalid Refresh Token') || error.message.includes('AuthApiError')) {
            console.warn('Handling stale session cleanly...');
            try {
              localStorage.removeItem('maternidade_premium_auth');
              for (const key in localStorage) {
                if (key.includes('supabase') || key.includes('-auth-token') || key.includes('maternidade_premium')) {
                  localStorage.removeItem(key);
                }
              }
            } catch (e) {}
            await supabase.auth.signOut().catch(() => {});
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

    // Check for Custom Magic Link
    const checkMagicLink = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const magicB64 = urlParams.get('magic');
        if (magicB64) {
          // Remove the parameter from URL immediately so it doesn't trigger on reload
          const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]magic=[^&]+/, '').replace(/^&/, '?');
          window.history.replaceState(null, '', cleanUrl);

          setAuthLoading(true);
          const targetEmail = atob(magicB64);
          console.log('[Magic Link] Attempting auto login for:', targetEmail);

          const data = await safeFetch('/api/v1/auth?action=login-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail })
          });

          if (!data || data.error) {
            toast.error(data?.error || 'Erro ao processar MagicLink');
            setAuthLoading(false);
            return;
          }

          if (data.tempPassword) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: targetEmail,
              password: data.tempPassword
            });
            if (signInError) {
              console.error('[Magic Link] Sign in failed:', signInError);
              toast.error('Ocorreu um erro no login via MagicLink.');
              setAuthLoading(false);
            } else {
              toast.success('Login realizado com sucesso via MagicLink!');
            }
          } else {
            // It's the master admin (no tempPassword returned)
            toast.info('MagicLink do Administrador. Insira sua senha para continuar.');
            localStorage.setItem('prefilled_email', targetEmail);
            setAuthLoading(false);
          }
        } else {
          // Check normal initial session
          await checkInitialSession();
        }
      } catch (err) {
        console.error('[Magic Link] Error processing magic link:', err);
        setAuthLoading(false);
        await checkInitialSession();
      }
    };

    checkMagicLink();

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
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [user]);

  // Google Analytics GA4 dynamic initialization
  useEffect(() => {
    // Avoid loading tracking scripts inside the sandboxed preview iframe to prevent security exceptions/Script errors
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) return;

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
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-bg-main text-white font-sans selection:bg-primary/30 text-pretty">
      {!user ? (
        <LoginPage />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <Dashboard user={user} />
        </Suspense>
      )}
    </div>
  );
}
