import React from "react";

type ScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
};

export function ScrollArea({ children, className = "" }: ScrollAreaProps) {
  return (
    <div className={`overflow-y-auto custom-scrollbar h-full w-full ${className}`}>
      {children}
    </div>
  );
}
