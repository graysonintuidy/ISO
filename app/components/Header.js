'use client';

import { Search, Bell, Sun, Moon, Menu, User } from 'lucide-react';
import { useTheme } from '@/app/components/ThemeProvider';
import styles from './Header.module.css';

const LOGO_URL = 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg';

export default function Header({ onMenuToggle, pageTitle, notificationCount = 0 }) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <header className={styles.header}>
      {/* Left: mobile menu + logo */}
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.logo}
          src={LOGO_URL}
          alt="National Beef logo"
        />
      </div>

      {/* Center: page title */}
      <div className={styles.center}>
        {pageTitle && <h1 className={styles.pageTitle}>{pageTitle}</h1>}
      </div>

      {/* Right: action buttons */}
      <div className={styles.actions}>
        <button className={styles.actionBtn} aria-label="Search">
          <Search size={18} />
        </button>

        <button className={styles.actionBtn} aria-label="Notifications">
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className={styles.badge}>
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        <button
          className={styles.actionBtn}
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        >
          {resolvedTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button className={styles.avatarBtn} aria-label="User menu">
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
