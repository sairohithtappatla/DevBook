import { useAuth } from "@/hooks/useAuth";
import { Home, Compass, BookOpen, BarChart3, User, LogOut } from "lucide-react";

type NavigationItem = {
  name: string;
  tabId: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navigation: NavigationItem[] = [
  { name: "Home", tabId: "home", icon: Home },
  { name: "Featured Books", tabId: "featured", icon: Compass },
  { name: "My Books", tabId: "books", icon: BookOpen },
  { name: "My Progress", tabId: "progress", icon: BarChart3 },
  { name: "My Profile", tabId: "profile", icon: User },
];

type SidebarProps = {
  currentTab: string;
  onChangeTab: (tabId: string) => void;
  className?: string;
};

export function Sidebar({ currentTab, onChangeTab, className = "" }: SidebarProps) {
  const { signOut } = useAuth();

  return (
    <aside
      className={`w-45 rounded-md bg-white border-r border-border flex flex-col h-full px-3 pt-5 pb-5 shrink-0 font-sidebar ${className}`}
    >
      {/* Brand Logo & Name — logo untouched, text size reduced to match target */}
      <div className="flex items-center gap-1.5 px-1.5 mb-6">
        <img src="/logo.svg" alt="DevBook" className="h-10 w-10" />
        <p className="text-base font-semibold leading-none text-text-primary font-sidebar">
          Dev<span className="text-[#818CF8]">Book</span>
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tabId;
          return (
            <button
              key={item.tabId}
              onClick={() => onChangeTab(item.tabId)}
              className={`w-full flex items-center gap-2.5 h-10 px-0  font-sidebar text-[13px] leading-none transition-all duration-150 cursor-pointer ${isActive
                ? "bg-surface-secondary text-text-primary font-semibold"
                : "text-text-secondary font-medium hover:bg-surface-secondary hover:text-text-primary"
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-text-primary" : "text-text-secondary"}`} />
              <span className="truncate font-sidebar text-[13px] font-bold text-current">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="border-t border-border/70 my-3 mx-1" />

      {/* Logout button */}
      <button
        onClick={() => signOut()}
        className="w-full flex items-center gap-2.5 h-9 px-2 rounded-lg font-sidebar text-xs leading-none font-medium text-text-secondary hover:bg-danger-light/10 hover:text-danger transition-all duration-150 cursor-pointer"
      >
        <LogOut className="w-4 h-4 text-text-secondary shrink-0" />
        <span className="truncate">Logout</span>
      </button>
    </aside>
  );
}
