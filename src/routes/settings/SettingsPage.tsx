import { useState } from "react";
import { McpConnectPanel } from "@/components/settings/McpConnectPanel";

const TABS = [{ id: "mcp", label: "MCP Connect" }] as const;
type TabId = (typeof TABS)[number]["id"];

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>("mcp");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 border-b border-hairline">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground font-semibold">Settings</div>
        <h1 className="text-xl font-bold tracking-tight text-foreground mb-3">Account settings</h1>
        <div role="tablist" className="flex gap-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`pb-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "mcp" && <McpConnectPanel />}
    </main>
  );
}
