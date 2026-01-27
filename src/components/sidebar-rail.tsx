"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* ----------------------------- Types ----------------------------- */

type NavIcon = () => ReactNode;

type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
};

type SidebarRailProps = {
  homeActive?: boolean;
  aiMirrorActive?: boolean;
};

/* ----------------------------- Icons ----------------------------- */

const iconStroke = "h-5 w-5 stroke-[1.5]";

const HomeIcon: NavIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconStroke}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InboxIcon: NavIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconStroke}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="22 6 12 13 2 6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SettingsIcon: NavIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconStroke}>
    <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusIcon: NavIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 stroke-[2]">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const SignOutIcon: NavIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 stroke-[1.5]">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MAIN_NAV: readonly NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Feeds", href: "/feeds", icon: SettingsIcon },
  { label: "AI Mirror", href: "/ai-mirror", icon: InboxIcon },
];

/* ---------------------------- Helpers ---------------------------- */

const isRouteActive = (pathname: string | null, href: string) => {
  if (!pathname) return false;
  if (!href || href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
};

/* -------------------------- Components -------------------------- */

const SidebarLink = ({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) => {
  const Icon = item.icon;
  
  const baseStyles = "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative";
  const activeStyles = "bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600 shadow-sm";
  const inactiveStyles = "text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:translate-x-1";

  return (
    <li>
      <Link
        href={item.href}
        className={`${baseStyles} ${active ? activeStyles : inactiveStyles}`}
        aria-current={active ? "page" : undefined}
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-slate-600'}`}>
          <Icon />
        </span>
        <span className="relative z-10 font-medium">{item.label}</span>
      </Link>
    </li>
  );
};

const NavSection = ({
  items,
  pathname,
  homeActive,
  aiMirrorActive,
}: {
  items: readonly NavItem[];
  pathname: string | null;
  homeActive?: boolean;
  aiMirrorActive?: boolean;
}) => {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isHome = item.label === "Home";
        const isAiMirror = item.label === "AI Mirror";
        const defaultActive = isRouteActive(pathname, item.href);
        const active = isAiMirror
          ? Boolean(aiMirrorActive)
          : isHome
          ? (homeActive ?? defaultActive)
          : defaultActive;

        return <SidebarLink key={item.label} item={item} active={active} />;
      })}
    </ul>
  );
};

/* ----------------------------- Main ----------------------------- */

export function SidebarRail({
  homeActive,
  aiMirrorActive,
}: SidebarRailProps = {}) {
  const pathname = usePathname();

  // FIX: Handle New Crawl Click
  const handleNewCrawlClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Clear the AI Mirror data so previous domain results don't persist
    try {
      localStorage.removeItem("ai-mirror-summary");
    } catch (err) {
      console.warn("Failed to clear localStorage", err);
    }
    // Navigation continues automatically via the Link href
  };

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex h-screen sticky top-0 z-20">
      {/* Top Branding */}
      <div className="flex h-20 items-center px-6 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="ml-3 text-lg font-bold text-slate-900 tracking-tight">
          Sitemap<span className="text-indigo-600">Pro</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-8">
        
        {/* Main Menu */}
        <div>
          <p className="px-4 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Main Menu
          </p>
          <NavSection
            items={MAIN_NAV}
            pathname={pathname}
            homeActive={homeActive}
            aiMirrorActive={aiMirrorActive}
          />
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        {/* Primary CTA with Fix */}
        <Link
          href="/"
          onClick={handleNewCrawlClick} // ADDED: Clear old data on click
          className="mb-4 flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5"
        >
          <PlusIcon className="text-indigo-200" />
          <span>New Crawl</span>
        </Link>
        
        {/* User Profile Card */}
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer group">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 text-white text-[10px] font-bold shadow-sm">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">Shimara Ilshani</p>
            <p className="text-[10px] text-slate-500 truncate">Administrator</p>
          </div>
          <div className="text-slate-300 group-hover:text-rose-500 transition-colors">
            <SignOutIcon />
          </div>
        </div>
      </div>
    </aside>
  );
}