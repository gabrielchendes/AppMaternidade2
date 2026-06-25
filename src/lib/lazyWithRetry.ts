import { ComponentType, lazy } from 'react';

// A resilient wrapper for lazy loading components that handles chunk load / dynamic import errors gracefully.
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      console.error('❌ Failed to dynamically load component, retrying...', error);
      
      const errorMessage = error?.message || '';
      const errorName = error?.name || '';
      
      const isChunkError = 
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('dynamic') ||
        errorMessage.includes('Script error') ||
        errorName === 'TypeError' ||
        errorName === 'ChunkLoadError' ||
        errorName === 'Script error' ||
        !errorMessage; // Empty error message is often a browser-shielded cross-origin Script error.

      if (isChunkError) {
        const hasReloaded = sessionStorage.getItem('chunk-failed-reload');
        if (!hasReloaded) {
          sessionStorage.setItem('chunk-failed-reload', 'true');
          console.warn('⚠️ Dynamic import chunk error detected. Force reloading page to fetch latest build...');
          window.location.reload();
          return new Promise<{ default: T }>(() => {}); // Keep pending while reload triggers
        }
      }
      
      throw error;
    }
  });
}
