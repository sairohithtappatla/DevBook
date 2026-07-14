import React from "react";
import { Globe, Mail } from "lucide-react";

// Custom SVG Icons since lucide-react exports are missing them in this project version
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" rx="1" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}


export function ProfileRightPanel() {

  const links = [
    { label: "GitHub", href: "https://github.com", icon: GithubIcon, value: "@rohith" },
    { label: "LinkedIn", href: "https://linkedin.com", icon: LinkedinIcon, value: "/in/rohith" },
    { label: "Website", href: "https://rohith.dev", icon: Globe, value: "rohith.dev" },
    { label: "Email", href: "mailto:rohith@devbook.com", icon: Mail, value: "rohith@devbook.com" }
  ];

  return (
    <div className="flex flex-col gap-4 h-full w-full select-none justify-between overflow-hidden">
      

      {/* 2. Links Card */}
      <div className="bg-surface border border-border rounded-xl p-3 shadow-xs flex flex-col shrink-0">
        <span className="font-heading text-[12px] font-bold text-text-primary pb-1.5 border-b border-border/40 mb-2 shrink-0">
          Links
        </span>

        <div className="flex flex-col gap-2 shrink-0">
          {links.map((link, idx) => {
            const Icon = link.icon;
            return (
              <a
                key={idx}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-surface-secondary text-[#4B5563] group-hover:text-primary group-hover:bg-primary-light flex items-center justify-center shrink-0 transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-text-primary truncate">
                    {link.label}
                  </span>
                </div>
                <span className="text-[9.5px] text-[#4B5563] group-hover:text-primary group-hover:underline transition-colors shrink-0">
                  {link.value}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
