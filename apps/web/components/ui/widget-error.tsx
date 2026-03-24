'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  override componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    this.setState({ hasError: true, error });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-danger)]/30 p-[var(--space-3)] text-center">
          <p className="text-xs font-medium text-[var(--color-danger)] mb-1">
            {this.props.title ?? 'Widget error'}
          </p>
          {this.state.error && (
            <p className="text-[10px] text-[var(--color-text-muted)] mb-2 truncate px-[var(--space-1)]">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
