import React from "react";

type RightPanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function RightPanel({ children, className = "" }: RightPanelProps) {
  return (
    <aside className={`w-[260px] shrink-0 h-full overflow-hidden flex flex-col p-3 space-y-2 ${className}`}>
      {children}
    </aside>
  );
}
