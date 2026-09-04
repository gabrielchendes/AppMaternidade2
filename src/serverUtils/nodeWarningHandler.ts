// Suppress Node.js DeprecationWarning DEP0169 (url.parse) from sub-dependencies (firebase-admin, google-auth, etc.)
// In Vercel serverless environments, any output to stderr is automatically labeled with [error].
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  const originalEmitWarning = (process as any).emitWarning;
  if (typeof originalEmitWarning === 'function') {
    (process as any).emitWarning = function (warning: any, ...args: any[]) {
      if (
        (typeof warning === 'string' && (warning.includes('DEP0169') || warning.includes('url.parse'))) ||
        (warning && (warning.code === 'DEP0169' || warning.name === 'DeprecationWarning') && String(warning.message || '').includes('url.parse'))
      ) {
        return;
      }
      return originalEmitWarning.apply(process, [warning, ...args]);
    };
  }

  process.on('warning', (warning: Error) => {
    const w = warning as any;
    if (w.name === 'DeprecationWarning' && (w.code === 'DEP0169' || String(w.message || '').includes('url.parse'))) {
      // Silenced to prevent false-positive [error] logs on Vercel
    }
  });
}

export function initNodeWarningHandler() {
  return true;
}
