import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (e: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error);
      return (
        <div role="alert" className="m-6 rounded-lg border border-destructive/40 bg-destructive/10 p-6">
          <h2 className="mb-2 text-base font-semibold text-destructive">
            Ha ocurrido un error inesperado
          </h2>
          <p className="mb-4 text-sm text-foreground/80">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
