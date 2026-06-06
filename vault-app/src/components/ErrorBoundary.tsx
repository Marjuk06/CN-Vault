import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary to catch React component tree crashes.
 * If a crash occurs, we force the vault to lock for security.
 */
export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Security measure: if the UI crashes, tell the backend to lock the vault immediately.
    // We cannot trust Zustand state if React has crashed.
    invoke('lock_vault').catch(console.error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#060609] flex items-center justify-center p-6 text-slate-200">
          <div className="max-w-md w-full glass-bright rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_32px_80px_rgba(0,0,0,0.8)] border border-red-500/20">
            <div className="w-16 h-16 rounded-[18px] bg-red-500/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Application Error</h1>
            <p className="text-sm text-white/50 mb-6 leading-relaxed">
              An unexpected error occurred. For your security, the vault has been locked.
            </p>
            
            {this.state.error && (
              <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-left overflow-hidden mb-6">
                <p className="text-[10px] font-mono text-red-400 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full btn-primary rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
