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
    console.log('Nova versão detectada.');

    const lastUpdate = sessionStorage.getItem('pwa-updated');
    const now = Date.now();

    // Permitir atualização se nunca atualizou ou se passou 1 minuto
    if (!lastUpdate || now - Number(lastUpdate) > 60000) {
      console.log('Atualizando app...');
      sessionStorage.setItem('pwa-updated', now.toString());
      window.location.reload();
    } else {
      console.log('Atualização ignorada para evitar loop.');
    }
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  }
});

// Forçar atualização ou limpeza do Service Worker ao abrir o app
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      // Se o script do SW estiver retornando erro de MIME (HTML em vez de JS), desregistra
      // Isso acontece quando o arquivo sw.js antigo não existe mais e o servidor retorna index.html
      if (reg.active?.scriptURL) {
        window.fetch(reg.active.scriptURL).then(res => {
          const contentType = res.headers.get('content-type');

          if (contentType && contentType.includes('text/html')) {
            console.warn('Service Worker inválido detectado. Removendo...', reg.active.scriptURL);
            reg.unregister().then(() => {
              console.log('Service Worker removido. Recarregando aplicação...');
              setTimeout(() => {
                window.location.reload();
              }, 500);
            });
          } else {
            reg.update().catch(err => console.error('Erro ao atualizar SW:', err));
          }
        }).catch(() => {
          reg.update().catch(() => {});
        });
      } else {
        // fallback seguro caso não exista SW ativo ainda
        reg.update().catch(() => {});
      }
    });
  });
}

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
