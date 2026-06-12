'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import styles from './AppShell.module.css';

const MOBILE_BREAKPOINT = 768;

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setCollapsed(true);
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
