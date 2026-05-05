// React error boundary. Wraps each top-level page so an unexpected render
// error doesn't blank the whole app — the user sees a recovery UI with the
// stack trace + "reload" button, and the rest of the shell stays usable.

import React from 'react';

interface Props {
  pageName: string;
  children: React.ReactNode;
}

interface State {
  err: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(error: Error): State {
    return { err: error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.pageName}]`, error, info);
  }

  reset = (): void => {
    this.setState({ err: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.err) return this.props.children;
    const e = this.state.err;
    return (
      <div className="p-10 max-w-3xl">
        <div className="card p-6 border-red-500/30 bg-red-500/5">
          <h1 className="text-lg font-semibold text-red-100">Something broke in {this.props.pageName}.</h1>
          <p className="text-sm text-ink-200/70 mt-1">
            The rest of the app is still usable. Try the recovery options below; if it keeps happening, capture the trace and report it.
          </p>
          <div className="mt-4 card p-3 bg-ink-900/60 text-xs font-mono text-ink-200/80 overflow-x-auto whitespace-pre-wrap">
            <div className="text-red-200 font-semibold">{e.name}: {e.message}</div>
            <div className="mt-2 text-ink-200/50 text-[11px]">{e.stack ?? '(no stack)'}</div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <button className="btn-primary" onClick={this.reset}>Try again</button>
            <button className="btn-ghost" onClick={this.reload}>Reload app</button>
          </div>
        </div>
      </div>
    );
  }
}
