import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

// Without this, an uncaught error anywhere in the tree (e.g. a preload API
// call failing because `window.screenStudio` isn't exposed) unmounts the
// whole app with nothing rendered in its place -- which looks exactly like
// the dark theme's near-black background doing nothing. This surfaces the
// actual error instead.
export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer] uncaught error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-semibold text-red-400">Something went wrong</p>
          <p className="max-w-md text-xs text-white/60">{this.state.error.message}</p>
          <p className="max-w-md text-xs text-white/40">
            Open DevTools (View → Toggle Developer Tools) for the full stack trace.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
