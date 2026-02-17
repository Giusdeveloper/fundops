import './globals.css';
import React from 'react';

// This layout is now handled by AppShell in root layout
// Keeping this file for backward compatibility but it just passes through
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
