"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCompany } from "../context/CompanyContext";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, FolderKanban, Users, LogOut, FileText, Building2, Menu, AlignJustify, Shield } from 'lucide-react';
import './Sidebar.css';
import type { UserUiContext } from "@/lib/auth/getUserUiContext";

interface SidebarProps {
  uiContext: UserUiContext;
}

interface MenuItem {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  requiresCompany: boolean;
}

const Sidebar = ({ uiContext }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [switchingViewMode, setSwitchingViewMode] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fundops_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  // Save collapsed state to localStorage and dispatch event
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('fundops_sidebar_collapsed', String(newState));
    // Dispatch custom event for immediate sync
    window.dispatchEvent(new CustomEvent('sidebarCollapseChange', { detail: { collapsed: newState } }));
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleLogout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsMobileOpen(false);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Se signOut fallisce lato client, procediamo comunque verso login.
    } finally {
      window.location.href = "/login";
    }
  };

  const startupMenuItems: MenuItem[] = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', requiresCompany: true },
    { href: '/investors', icon: Users, label: 'Investitori', requiresCompany: true },
    { href: '/lois', icon: FileText, label: 'LOI', requiresCompany: true },
    { href: '/issuance', icon: FolderKanban, label: 'Issuance', requiresCompany: true },
    { href: '/companies', icon: Building2, label: 'Companies', requiresCompany: false },
  ];

  if (uiContext.isImmentAdmin) {
    startupMenuItems.push({
      href: '/admin',
      icon: Shield,
      label: 'Admin',
      requiresCompany: false,
    });
  }

  const investorMenuItems: MenuItem[] = [
    { href: '/investor/dashboard', icon: Users, label: 'Investor Area', requiresCompany: false },
  ];

  const menuItems = uiContext.effectiveArea === "investor" ? investorMenuItems : startupMenuItems;

  const handleLinkClick = (e: React.MouseEvent, item: MenuItem) => {
    // Se richiede company e non c'è activeCompanyId, redirect a /companies
    if (item.requiresCompany && !activeCompanyId) {
      e.preventDefault();
      router.push('/companies');
      return;
    }
  };

  const handleSwitchViewMode = async (nextMode: "startup" | "investor") => {
    if (!uiContext.isImmentAdmin || switchingViewMode) return;
    setSwitchingViewMode(true);
    try {
      const res = await fetch("/api/auth/set-view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view_mode: nextMode }),
      });
      if (!res.ok) return;
      window.location.href = nextMode === "investor" ? "/investor/dashboard" : "/dashboard";
    } finally {
      setSwitchingViewMode(false);
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button 
        className="sidebar-mobile-toggle"
        onClick={toggleMobile}
        aria-label="Toggle sidebar"
      >
        <Menu size={24} />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="sidebar-overlay"
          onClick={toggleMobile}
        />
      )}

      <aside className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Collapse toggle button */}
        <button 
          className="sidebar-collapse-toggle"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <AlignJustify size={20} />
        </button>

        <nav className="sidebar-nav">
          {uiContext.isImmentAdmin && (
            <div className="sidebar-viewmode-switcher">
              <button
                type="button"
                className={`sidebar-viewmode-btn ${uiContext.effectiveArea === "startup" ? "active" : ""}`}
                disabled={switchingViewMode || uiContext.effectiveArea === "startup"}
                onClick={() => handleSwitchViewMode("startup")}
              >
                Vista Startup
              </button>
              <button
                type="button"
                className={`sidebar-viewmode-btn ${uiContext.effectiveArea === "investor" ? "active" : ""}`}
                disabled={switchingViewMode || uiContext.effectiveArea === "investor"}
                onClick={() => handleSwitchViewMode("investor")}
              >
                Vista Investitore
              </button>
            </div>
          )}
          <ul>
            {menuItems.map((item) => {
              const Icon = item.icon;
            const isActive = pathname?.startsWith(item.href) || (item.href === '/dashboard' && (pathname === '/' || pathname === '/dashboard'));
            const href = item.href;

              return (
                <li key={item.href} className={isActive ? 'active' : ''}>
                  <Link 
                    href={href} 
                    className="sidebar-link"
                    onClick={(e) => {
                      handleLinkClick(e, item);
                      setIsMobileOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="sidebar-link-left">
                      <Icon size={18} className="sidebar-icon"/>
                      {!isCollapsed && (
                        <span className="sidebar-label">{item.label}</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-divider"></div>
        <a 
          href="/login" 
          className="sidebar-logout-link"
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Logout</span>}
        </a>
      </aside>
    </>
  );
};

export default Sidebar; 
