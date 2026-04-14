import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { I18nProvider } from './contexts/I18nContext';
import { TenantProvider } from './contexts/TenantContext';

import { registerSW } from 'virtual:pwa-register';

registerSW({ 
  immediate: true,
  onNeedRefresh() {
    console.log('Nova versão do app disponível. Atualizando...');
    window.location.reload();
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  }
});

console.log('Nova versão do app carregada');

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
