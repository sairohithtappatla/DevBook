import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 border border-danger/30 rounded-xl bg-danger-light/10 text-danger flex items-start gap-3 w-full">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-heading text-sm font-bold leading-tight">Rendering Error</h4>
            <p className="text-[12px] text-text-secondary leading-normal">
              An error occurred while displaying this section. Please try refreshing or check syntax.
            </p>
            {this.state.error && (
              <pre className="text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded-lg font-mono text-text-muted mt-2 max-w-full overflow-x-auto">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
