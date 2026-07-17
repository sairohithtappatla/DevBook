import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/stores/theme";
import { Home, Compass, BookOpen, BarChart3, User, LogOut, Users } from "lucide-react";

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
  { name: "Authors", tabId: "authors", icon: Users },
  { name: "My Profile", tabId: "profile", icon: User },
];

type SidebarProps = {
  currentTab: string;
  onChangeTab: (tabId: string) => void;
  className?: string;
};

export function Sidebar({ currentTab, onChangeTab, className = "" }: SidebarProps) {
  const { signOut } = useAuth();
  const [theme, , toggle] = useTheme();
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className={`w-45 rounded-md bg-sidebar border-r border-border flex flex-col h-full px-3 pt-5 pb-5 shrink-0 font-sidebar transition-all duration-200 ease-in-out ${className}`}
    >
      {/* Brand Logo & Name — logo untouched, text size reduced to match target */}
      <div className="flex items-center gap-1.5 px-1.5 mb-6">
        <svg
          viewBox="0 0 31.691 31.691"
          className="h-11 w-11 fill-current text-text-primary transition-all duration-200"
        >
          <path d="M16.868,6.977h2.517v0.695h-2.517V6.977z M19.379,8.124h-2.516v0.697h2.516V8.124z M14.09,6.977h-2.519v0.695h2.519V6.977z M31.691,20.605v1.672h-3.752v4.992h-2.146v-4.992H5.695v5.16H3.547v-5.16H0v-1.672h4.606l-2.522-0.58L5.697,4.254l4.653,1.064 V4.762h4.963v15.844h0.33V4.604h4.962v16.001h0.651V4.604h4.966v16.001H31.691z M6.411,20.322L9.723,5.873L6.208,5.068 l-3.311,14.45L6.411,20.322z M10.35,6.18L7.044,20.607h3.306V6.18z M14.634,18.667h-3.605v1.599h3.605V18.667z M11.627,16.846 v0.648h2.492v-0.648H11.627z M14.119,16.412v-0.647h-2.492v0.647H14.119z M14.634,5.443h-3.605v9.148h3.605V5.443z M19.926,20.107 V5.284H16.32v14.823H19.926z M25.543,5.284h-3.605v14.823h3.605V5.284z M24.66,6.653h-0.695v8.229h0.695V6.653z M23.512,6.636 h-0.697v8.228h0.697V6.636z M7.898,7.223l-1.884,8.225l0.628,0.144l1.884-8.225L7.898,7.223z M6.641,6.977l-1.885,8.224 l0.628,0.144l1.885-8.224L6.641,6.977z M19.379,15.763h-2.516v0.694h2.516V15.763z M16.868,17.693h-2.517v-0.694h-2.517V17.693z" />
        </svg>
        <p className="text-xl font-semibold leading-none text-text-primary font-sidebar">
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

      {/* Spacer to push toggle to the bottom */}
      <div className="flex-1" />

      {/* Theme Toggle Card */}
      <div className="relative w-full">
        <input
          id="theme-switch"
          type="checkbox"
          className="theme-checkbox"
          checked={theme === "dark"}
          onChange={toggle}
        />
        <div className="theme-toggle-container">
          <nav>
            <time className="time">{time}</time>
            <div className="icons flex items-center gap-1">
              <span className="network"></span>
              <span className="battery"></span>
            </div>
          </nav>
          <div className="circle"></div>
          <label htmlFor="theme-switch">
            <span className="light">light</span>
            <span>dark</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
