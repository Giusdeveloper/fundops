"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCompany } from "../context/CompanyContext";
import { LayoutDashboard, FolderKanban, Users, Settings, LogOut, FileText, Building2, Menu, AlignJustify, Shield } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', requiresCompany: true, disabled: false },
    { href: '/investors', icon: Users, label: 'Investitori', requiresCompany: true, disabled: false },
    { href: '/investor', icon: Users, label: 'Area Investitore', requiresCompany: false, disabled: false },
    { href: '/lois', icon: FileText, label: 'LOI', requiresCompany: true, disabled: false },
    { href: '/companies', icon: Building2, label: 'Companies', requiresCompany: false, disabled: false },
    { href: '/admin', icon: Shield, label: 'Admin', requiresCompany: false, disabled: false },
    { href: '/progetti', icon: FolderKanban, label: 'Progetti', requiresCompany: false, disabled: true },
    { href: '/impostazioni', icon: Settings, label: 'Impostazioni', requiresCompany: false, disabled: true }
  ];

  const handleLinkClick = (e: React.MouseEvent, item: typeof menuItems[0]) => {
    // Prevenire navigazione solo per item disabled
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    // Se richiede company e non c'è activeCompanyId, redirect a /companies
    if (item.requiresCompany && !activeCompanyId) {
      e.preventDefault();
      router.push('/companies');
      return;
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
          <ul>
            {menuItems.map((item) => {
              const Icon = item.icon;
            const isActive = !item.disabled && (pathname?.startsWith(item.href) || (item.href === '/dashboard' && (pathname === '/' || pathname === '/dashboard')));
            const isDisabled = item.disabled;
            // Link puliti senza querystring - il context gestisce la company
            const href = item.disabled ? '#' : item.href;

              return (
                <li key={item.href} className={isActive && !item.disabled ? 'active' : ''}>
                  <Link 
                    href={href} 
                    className={`sidebar-link ${isDisabled ? 'sidebar-link-disabled' : ''}`}
                    onClick={(e) => {
                      handleLinkClick(e, item);
                      setIsMobileOpen(false);
                    }}
                    title={isCollapsed || item.disabled ? (item.disabled ? "Coming Soon" : item.label) : undefined}
                  >
                    <div className="sidebar-link-left">
                      <Icon size={18} className="sidebar-icon"/>
                      {!isCollapsed && (
                        <>
                          <span className="sidebar-label">{item.label}</span>
                          {item.disabled && (
                            <span className="sidebar-coming-soon">Coming Soon</span>
                          )}
                        </>
                      )}
                    </div>
                    {isCollapsed && item.disabled && (
                      <span className="sidebar-tooltip-collapsed">Coming Soon</span>
                    )}
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
          onClick={() => setIsMobileOpen(false)}
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
