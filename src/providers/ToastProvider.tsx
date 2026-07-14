import React, { createContext, useState, useContext, useCallback } from "react";
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "info" | "warning" | "error";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-danger" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return "border-[#16A34A] bg-[#F0FDF4]";
      case "warning":
        return "border-warning bg-[#FEF3C7]";
      case "error":
        return "border-danger bg-[#FEE2E2]";
      case "info":
      default:
        return "border-primary bg-[#EFF6FF]";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Overlay Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full select-none pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto border-l-4 p-4 rounded-r-xl shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200 ${getBorderColor(
              toast.type
            )}`}
          >
            <div className="flex items-center gap-2.5">
              {getIcon(toast.type)}
              <span className="text-[13px] font-semibold text-text-primary font-sans leading-tight">
                {toast.message}
              </span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
