import React from "react";

type SectionProps = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, subtitle, action, children, className = "" }: SectionProps) {
  return (
    <section className={`flex flex-col space-y-2 ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div className="space-y-1">
            {title && (
              <h2 className="font-heading text-xl md:text-2xl font-semibold text-text-primary tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="font-body text-sm text-text-secondary">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}
      <div className="font-body flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}
