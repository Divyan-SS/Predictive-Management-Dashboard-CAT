import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

// Role-based permissions mapping for menu items
type UserRole = "Super Admin" | "Maintenance Team" | "Service Team";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles: UserRole[];
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  darkMode,
  setDarkMode,
  onLogout
}) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Reusable SVG icons for items
  const Icons = {
    Dashboard: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    Sites: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    Machines: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M13 16h6M19 16h2a1 1 0 001-1v-4a1 1 0 00-1-1h-2m-6 0h6m-6 0a3 3 0 003-3V7a1 1 0 00-1-1h-2" />
      </svg>
    ),
    Maintenance: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    Service: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    Predictions: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707-.707m12.728 12.728l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
    Reports: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    Users: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Messages: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    Logout: () => (
      <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    Sun: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707-.707m12.728 12.728l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
    Moon: () => (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    Hamburger: () => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    Close: () => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    ChevronLeft: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    ),
    ChevronRight: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    )
  };

  // Sidebar Menu Items definitions matching role access constraints
  const menuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: <Icons.Dashboard />, allowedRoles: ["Super Admin", "Maintenance Team", "Service Team"] },
    { id: "sites", label: "Sites", icon: <Icons.Sites />, allowedRoles: ["Super Admin"] },
    { id: "maintenance", label: "Maintenance", icon: <Icons.Maintenance />, allowedRoles: ["Maintenance Team"] },
    { id: "service", label: "Service", icon: <Icons.Service />, allowedRoles: ["Service Team"] },
    { id: "reports", label: "Reports", icon: <Icons.Reports />, allowedRoles: ["Super Admin"] },
    { id: "messages", label: "Messages", icon: <Icons.Messages />, allowedRoles: ["Super Admin", "Maintenance Team", "Service Team"] },
    { id: "profile", label: "Profile", icon: <Icons.Users />, allowedRoles: ["Super Admin", "Maintenance Team", "Service Team"] }
  ];

  // Filter items matching userRole
  const allowedMenuItems = menuItems.filter((item) => item.allowedRoles.includes(userRole));

  // Renders navigation buttons
  const renderNavList = () => (
    <div className="space-y-1 py-4 px-2">
      {allowedMenuItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setMobileOpen(false);
            }}
            title={isCollapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              isActive
                ? "bg-[#FFCD00] text-black shadow-md"
                : "text-stone-500 hover:bg-[#FFCD11]/10 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            }`}
          >
            {item.icon}
            {(!isCollapsed || mobileOpen) && <span>{item.label}</span>}
          </button>
        );
      })}

      {/* Logout button triggers profile clear */}
      <button
        onClick={() => {
          if (onLogout) onLogout();
        }}
        title={isCollapsed ? "Logout" : undefined}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-all duration-200 mt-4 cursor-pointer"
      >
        <Icons.Logout />
        {(!isCollapsed || mobileOpen) && <span>Logout</span>}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header containing Hamburger trigger */}
      <div className="md:hidden bg-[#FFFBEB] text-stone-800 dark:bg-stone-900 dark:text-stone-100 p-4 flex items-center justify-between border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <div className="bg-[#FFCD00] text-black font-extrabold px-2 py-1 rounded text-sm tracking-tighter">
            CAT
          </div>
          <span className="font-extrabold text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">Predictive</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 p-1 rounded focus:outline-none"
        >
          {mobileOpen ? <Icons.Close /> : <Icons.Hamburger />}
        </button>
      </div>

      {/* Desktop Collapsible Sidebar panel */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 h-full overflow-y-auto bg-[#FFFBEB] dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 transition-all duration-300 relative ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div>
          {/* Top Brand area */}
          <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="bg-[#FFCD00] text-black font-extrabold px-3 py-1.5 rounded tracking-tighter text-md shrink-0 shadow-sm">
                CAT
              </div>
              {!isCollapsed && (
                <div className="animate-fade-in">
                  <h1 className="text-stone-800 dark:text-stone-100 font-bold text-xs tracking-wide leading-3">PREDICTIVE</h1>
                  <p className="text-stone-500 font-semibold text-[10px] tracking-wider">MAINTENANCE</p>
                </div>
              )}
            </div>
          </div>

          {/* Nav List */}
          {renderNavList()}
        </div>

        {/* Footer controls & Profile details */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-950/40 space-y-3">
          {!isCollapsed && (
            <div className="p-2 bg-stone-50 dark:bg-stone-900/60 rounded border border-stone-200 dark:border-stone-800/80 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#FFCD00] text-black font-extrabold flex items-center justify-center text-xs">
                {userRole[0]}
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-700 dark:text-stone-300 block truncate">
                  {user?.name || "Operator Account"}
                </span>
                <Badge variant="warning" className="px-1 py-0 text-[8px]">
                  {userRole}
                </Badge>
              </div>
            </div>
          )}

          {/* Theme switcher */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-600 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 rounded text-[10px] font-bold transition-all border border-stone-200 dark:border-stone-700 active:scale-[0.98] cursor-pointer"
          >
            {darkMode ? <Icons.Sun /> : <Icons.Moon />}
            {!isCollapsed && <span>{darkMode ? "Light Theme" : "Dark Theme"}</span>}
          </button>

          {/* Collapse toggle control */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded flex items-center justify-center text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors border border-stone-200 dark:border-stone-800/50 cursor-pointer"
          >
            {isCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay Panel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop screen filter */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer content drawer */}
          <div className="relative flex flex-col w-5/6 max-w-sm bg-[#FFFBEB] dark:bg-stone-900 h-full border-r border-stone-200 dark:border-stone-800 z-10 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <div className="bg-[#FFCD00] text-black font-extrabold px-3 py-1 rounded text-md tracking-tighter">
                  CAT
                </div>
                <span className="font-extrabold text-sm uppercase tracking-widest text-stone-700 dark:text-stone-300">Operations Hub</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 p-1"
              >
                <Icons.Close />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {renderNavList()}
            </div>

            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
              <div className="p-2 bg-stone-50 dark:bg-stone-900/60 rounded border border-stone-200 dark:border-stone-800/80 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FFCD00] text-black font-extrabold flex items-center justify-center text-xs">
                  {userRole[0]}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-stone-700 dark:text-stone-300 block">
                    Active Operator
                  </span>
                  <Badge variant="warning" className="px-1 py-0 text-[8px]">
                    {userRole}
                  </Badge>
                </div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 rounded text-xs font-bold transition-all border border-stone-200 dark:border-stone-700 active:scale-[0.98] cursor-pointer"
              >
                {darkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
