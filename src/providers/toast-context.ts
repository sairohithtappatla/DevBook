import { createContext } from "react";

export type ToastType = "success" | "info" | "warning" | "error";

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
