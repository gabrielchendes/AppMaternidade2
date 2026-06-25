import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { I18nProvider } from './contexts/I18nContext';
import { TenantProvider } from './contexts/TenantContext';
import ErrorBoundary from './components/ErrorBoundary';

import { registerSW } from 'virtual:pwa-register';

// Faster SW registration safely wrapped to prevent sandbox iframe exceptions
const isIframe = typeof window !== 'undefined' && window.self !== window.top;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isIframe) {
  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('Update found, reloading...');
        try {
          updateSW(true);
        } catch (e) {
          console.error('Failed to trigger SW update:', e);
        }
      },
      onOfflineReady() {
        console.log('App ready for offline use');
      }
    });
  } catch (err) {
    console.warn('Service Worker registration skipped or failed under this environment context:', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <TenantProvider>
        <SettingsProvider>
          <I18nProvider>
            <App />
            <Toaster position="top-center" richColors theme="dark" />
          </I18nProvider>
        </SettingsProvider>
      </TenantProvider>
    </ErrorBoundary>
  </StrictMode>,
);
