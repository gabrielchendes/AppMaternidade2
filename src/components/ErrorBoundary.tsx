import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    
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
        console.warn('⚠️ ErrorBoundary caught a dynamic chunk load or network failure. Automatically reloading page to get latest changes...');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-400 text-sm mb-8 max-w-xs">
            We had an issue loading this part of the application. Please try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
          >
            <RefreshCcw size={16} />
            Reload App
          </button>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-zinc-900 rounded-lg text-left overflow-auto max-w-full">
              <p className="text-red-400 font-mono text-[10px] whitespace-pre-wrap">
                {this.state.error?.toString()}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
