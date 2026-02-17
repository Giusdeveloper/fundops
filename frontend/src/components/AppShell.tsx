'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import AppContainer from './AppContainer';
import '../app/(app)/dashboard.css';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  
  // Don't show sidebar on login/auth pages
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/auth');
  const isPortalPage = pathname?.startsWith('/portal');
  
  if (isAuthPage || isPortalPage) {
    return <>{children}</>;
  }

  // Use consistent className structure to avoid hydration mismatch
  const layoutClassName = 'dashboard-layout';
  const contentClassName = 'dashboard-main-content';
  
  return (
    <div className={layoutClassName}>
      <Sidebar />
      <div className={contentClassName}>
        <Header />
        <AppContainer>{children}</AppContainer>
      </div>
    </div>
  );
}
