import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { I18nProvider } from './contexts/I18nContext';
import { TenantProvider } from './contexts/TenantContext';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('SW registered: ', registration);
      },
      (registrationError) => {
        console.log('SW registration failed: ', registrationError);
      }
    );
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantProvider>
      <SettingsProvider>
        <I18nProvider>
          <App />
          <Toaster position="top-center" richColors theme="dark" />
        </I18nProvider>
      </SettingsProvider>
    </TenantProvider>
  </StrictMode>,
);
