'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import styles from './AppShell.module.css';

const MOBILE_BREAKPOINT = 768;

// Routes that render without the shell (no sidebar/header)
const SHELL_EXCLUDED_PATHS = ['/login'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check if current route should skip the shell
  const skipShell = SHELL_EXCLUDED_PATHS.some((p) => pathname?.startsWith(p));

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (skipShell) return;
    const handleResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setCollapsed(true);
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [skipShell]);

  const handleToggle = useCallback(() => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // On excluded paths, render children directly (full-screen login, etc.)
  if (skipShell) {
    return <>{children}</>;
  }

  const mainClass = [
    styles.main,
    collapsed ? styles.sidebarCollapsed : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.shell}>
      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />
      <div className={mainClass}>
        <Header onMenuToggle={handleToggle} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

