'use client';

import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Menu, User, LogOut, Shield, ChevronDown } from 'lucide-react';
import { useTheme } from '@/app/components/ThemeProvider';
import { useAuth } from '@/app/components/AuthProvider';
import styles from './Header.module.css';

const LOGO_URL = 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg';

const ROLE_COLORS = {
  admin: { bg: 'rgba(220, 38, 38, 0.12)', color: '#f87171', border: 'rgba(220, 38, 38, 0.25)' },
  manager: { bg: 'rgba(37, 99, 235, 0.12)', color: '#93c5fd', border: 'rgba(37, 99, 235, 0.25)' },
  operator: { bg: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.25)' },
  viewer: { bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
};

export default function Header({ onMenuToggle, pageTitle }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  // Get user initials for avatar
  const initials = user
    ? (user.firstName?.[0] || '') + (user.lastName?.[0] || user.email?.[0]?.toUpperCase() || '')
    : '';

  const roleStyle = ROLE_COLORS[user?.role] || ROLE_COLORS.viewer;

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

        <button
          className={styles.actionBtn}
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        >
          {resolvedTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User avatar + dropdown */}
        {isAuthenticated && (
          <div className={styles.userMenuContainer} ref={menuRef}>
            <button
              className={styles.avatarBtn}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="User menu"
              aria-expanded={menuOpen}
            >
              {initials || <User size={16} />}
            </button>

            {menuOpen && (
              <div className={styles.userDropdown}>
                {/* User Info */}
                <div className={styles.userInfo}>
                  <div className={styles.userAvatar}>
                    {initials || <User size={18} />}
                  </div>
                  <div className={styles.userDetails}>
                    <span className={styles.userName}>
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.username || user.email}
                    </span>
                    <span className={styles.userEmail}>{user.email}</span>
                  </div>
                </div>

                {/* Role Badge */}
                <div className={styles.roleSection}>
                  <Shield size={13} />
                  <span
                    className={styles.roleBadge}
                    style={{
                      background: roleStyle.bg,
                      color: roleStyle.color,
                      borderColor: roleStyle.border,
                    }}
                  >
                    {user.roleDisplayName || user.role}
                  </span>
                </div>

                {/* Divider + Logout */}
                <div className={styles.dropdownDivider} />
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

