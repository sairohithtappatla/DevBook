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
      className={`w-[268px] bg-white border-r border-border flex flex-col h-full px-5 pt-6 pb-6 shrink-0 ${className}`}
    >
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5 px-1.5 mb-5">
        <img src="/logo.svg" alt="DevBook" className="h-10 w-10" />
        <p className="text-xl font-semibold leading-none text-text-primary font-heading">
          Dev<span className="text-[#818CF8]">Book</span>
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1.5 mt-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tabId;
          return (
            <button
              key={item.tabId}
              onClick={() => onChangeTab(item.tabId)}
              className={`w-full flex items-center gap-2.5 h-9 px-2 rounded-lg font-sans font-medium text-sm transition-all duration-150 cursor-pointer ${isActive
                  ? "bg-surface-secondary text-text-primary font-semibold"
                  : "text-text-secondary hover:bg-surface-secondary/50 hover:text-text-primary"
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-text-primary" : "text-text-secondary"}`} />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}

        {/* Separator Line */}
        <div className="border-t border-border/80 my-3 mx-1" />

        {/* Logout button */}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2.5 h-9 px-2 rounded-lg font-body font-medium text-sm text-text-secondary hover:bg-danger-light/10 hover:text-danger transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-text-secondary shrink-0" />
          <span className="truncate">Logout</span>
        </button>
      </nav>
    </aside>
  );
}
