import { ComponentType, lazy } from 'react';

// A resilient wrapper for lazy loading components that handles chunk load / dynamic import errors gracefully.
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retriesLeft = 3,
  interval = 600
) {
  return lazy(async () => {
    let currentTry = 0;
    while (true) {
      try {
        const mod = await componentImport();
        if (!mod || typeof mod.default === 'undefined') {
          throw new Error('Dynamic module import did not export a default React component');
        }
        return mod;
      } catch (error: any) {
        currentTry++;
        if (currentTry <= retriesLeft) {
          console.warn(`[lazyWithRetry] Retrying dynamic import (${currentTry}/${retriesLeft})...`, error);
          await new Promise((resolve) => setTimeout(resolve, interval * currentTry));
          continue;
        }

        const errorMessage = error?.message || '';
        const errorName = error?.name || '';

        const isChunkOrNetworkError = 
          errorMessage.includes('Failed to fetch dynamically imported module') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('fetch resource') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('Loading chunk') ||
          errorMessage.includes('dynamic') ||
          errorMessage.includes('Script error') ||
          errorName === 'TypeError' ||
          errorName === 'ChunkLoadError' ||
          errorName === 'Script error' ||
          !errorMessage;

        if (isChunkOrNetworkError) {
          const hasReloaded = sessionStorage.getItem('chunk-failed-reload');
          if (!hasReloaded) {
            sessionStorage.setItem('chunk-failed-reload', 'true');
            console.warn('⚠️ Dynamic import chunk or network error detected. Force reloading page to fetch latest build...');
            window.location.reload();
            return new Promise<{ default: T }>(() => {}); // Keep pending while reload triggers
          }
        }

        throw error;
      }
    }
  });
}

