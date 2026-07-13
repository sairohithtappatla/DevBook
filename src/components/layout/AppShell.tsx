import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNavigation } from "./TopNavigation";
import { Drawer } from "./Drawer";
import { RightPanel } from "./RightPanel";
import { ScrollArea } from "./ScrollArea";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type AppShellProps = {
  currentTab: string;
  onChangeTab: (tabId: string) => void;
  children: React.ReactNode;
  rightPanelContent?: React.ReactNode;
  showSearch?: boolean;
  title?: string;
};


export function AppShell({
  currentTab,
  onChangeTab,
  children,
  rightPanelContent,
  showSearch = true,
  title,
}: AppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  // Close the drawer if we transition to desktop
  React.useEffect(() => {
    if (isLargeScreen && isDrawerOpen) {
      setIsDrawerOpen(false);
    }
  }, [isLargeScreen, isDrawerOpen]);

  const handleTabChange = (tabId: string) => {
    onChangeTab(tabId);
    setIsDrawerOpen(false);
  };


  return (
    <div className="h-screen w-screen flex overflow-hidden bg-surface-secondary text-text-primary">
      {/* Permanent Left Sidebar (>= 1024px) - spans full height */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={handleTabChange}
        className="hidden lg:flex shrink-0"
      />

      {/* Mobile/Tablet Navigation Drawer (< 1024px) */}
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <Sidebar
          currentTab={currentTab}
          onChangeTab={handleTabChange}
          className="w-full border-r-0 p-0"
        />
      </Drawer>

      {/* Main Content Pane to the right of the sidebar */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Fixed Navigation */}
        <TopNavigation
          onMenuClick={() => setIsDrawerOpen(true)}
          showSearch={showSearch}
          title={title}
        />

        {/* Content columns (Center Feed + Right Panel) */}
        <div className="flex-1 flex overflow-hidden w-full relative">
          {/* Center Feed (Main content area) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <ScrollArea className="bg-surface-secondary">
              {children}
            </ScrollArea>
          </div>

          {/* Right Panel (>= 1280px) */}
          {rightPanelContent && (
            <RightPanel className="hidden xl:block">
              {rightPanelContent}
            </RightPanel>
          )}
        </div>
      </div>
    </div>
  );
}
