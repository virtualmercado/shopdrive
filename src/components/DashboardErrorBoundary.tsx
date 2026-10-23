import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryKey: number;
  /** Retries already attempted for the current failure streak. */
  attempts: number;
}

/** After this many in-place retries, "Tentar novamente" performs one controlled reload. */
export const MAX_INPLACE_RETRIES = 1;

export function nextRetryAction(attempts: number): "rerender" | "reload" {
  return attempts < MAX_INPLACE_RETRIES ? "rerender" : "reload";
}

/**
 * Error boundary for the merchant dashboard only (mounted by MerchantRoute).
 * Prevents a render exception from leaving a blank page. Never re-runs saves.
 */
export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0, attempts: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Technical log only: no form content, tokens or personal data.
    if (import.meta.env.DEV) {
      console.error("[DashboardErrorBoundary]", {
        route: window.location.pathname,
        errorName: error?.name,
        errorMessage: error?.message,
        componentStack: info?.componentStack?.split("\n").slice(0, 8).join("\n"),
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error("[DashboardErrorBoundary]", error?.name, window.location.pathname);
    }
  }

  handleRetry = () => {
    if (nextRetryAction(this.state.attempts) === "reload") {
      window.location.reload();
      return;
    }
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1, attempts: prev.attempts + 1 }));
  };

  handleDashboard = () => {
    window.location.assign("/lojista");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
          <div className="w-full max-w-md text-center space-y-4">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-foreground">Não foi possível carregar esta página</h1>
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado. Você pode tentar novamente sem perder o acesso à sua conta.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={this.handleRetry} autoFocus>Tentar novamente</Button>
              {window.location.pathname !== "/lojista" && (
                <Button variant="outline" onClick={this.handleDashboard}>Voltar ao Dashboard</Button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return <div key={this.state.retryKey} className="contents">{this.props.children}</div>;
  }
}

export default DashboardErrorBoundary;
