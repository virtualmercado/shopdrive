import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Public store slug, used only for safe technical logging. */
  storeSlug?: string;
}

interface State {
  hasError: boolean;
  retryKey: number;
}

/**
 * Error boundary for the PUBLIC store routes only.
 * Prevents an unhandled render exception from unmounting the React tree
 * and leaving a completely blank document.
 */
export class PublicStoreErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Technical log only — no tokens, no customer data, no store payload.
    console.error("[PublicStoreErrorBoundary]", {
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      storeSlug: this.props.storeSlug,
      errorName: error?.name,
      errorMessage: error?.message,
      componentStack: info?.componentStack,
      timestamp: new Date().toISOString(),
      env: import.meta.env.MODE,
    });
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
          <div className="w-full max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">
              Loja temporariamente indisponível
            </h1>
            <p className="text-muted-foreground">
              Não foi possível carregar esta loja neste momento. Tente novamente em
              alguns instantes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={this.handleRetry}>Tentar novamente</Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                Voltar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

export default PublicStoreErrorBoundary;
