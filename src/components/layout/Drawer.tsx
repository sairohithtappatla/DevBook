import React, { useEffect } from "react";
import { X } from "lucide-react";

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Drawer({ isOpen, onClose, children }: DrawerProps) {
  // Prevent body scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div className="relative flex w-[280px] max-w-[85vw] flex-col bg-sidebar border-r border-border h-full p-6 shadow-md animate-fade-in z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-surface-secondary text-text-secondary cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-y-auto custom-scrollbar mt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
