import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('React error boundary caught error', {
      error: error.message,
      stack: error.stack ?? '',
      componentStack: info.componentStack ?? '',
    });
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="p-6 bg-red-950/50 border border-red-800/60 rounded-lg text-center space-y-3"
        >
          <p className="text-red-300 font-medium">Something went wrong</p>
          <p className="text-red-400/80 text-sm">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-zinc-800 text-zinc-200 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
