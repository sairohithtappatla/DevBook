import React from "react";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`w-full max-w-[1280px] mx-auto px-6 py-2 md:px-8 md:py-3 space-y-6 ${className}`}>
      {children}
    </div>
  );
}
