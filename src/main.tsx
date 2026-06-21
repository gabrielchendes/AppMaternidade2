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

// Faster SW registration
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Update found, reloading...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  }
});

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
