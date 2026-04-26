import { useState, useEffect, useCallback } from 'react';
import { isPWAInstalled, getPWADismissed } from '../lib/pwa';

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsInstalled(isPWAInstalled());
    setIsDismissed(getPWADismissed());

    const handler = (e: any) => {
      console.log('📦 PWA: beforeinstallprompt event captured');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const appInstalledHandler = () => {
      console.log('📦 PWA: appinstalled event captured');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('📦 PWA: promptInstall called but deferredPrompt is null. Device might not meet PWA criteria or event not fired yet.');
      return false;
    }
    
    console.log('📦 PWA: Triggering native install prompt...');
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`📦 PWA: User choice outcome: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable,
    isInstalled,
    isDismissed,
    promptInstall,
    deferredPrompt
  };
};
