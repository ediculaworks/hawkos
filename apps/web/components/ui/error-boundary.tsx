'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  override componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    this.setState({ hasError: true, error });
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <div className="flex flex-col items-center justify-center p-6 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-danger)]/30">
          <p className="text-sm font-medium text-[var(--color-danger)] mb-2">Algo deu errado</p>
          {this.state.error && (
            <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-xs truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
