'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Camera,
  Factory,
  ShieldAlert,
  Users,
  Truck,
  AlertTriangle,
  FileText,
  ScrollText,
  Settings,
  UserCog,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_SECTIONS = [
  {
    label: 'MONITORING',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/cameras', label: 'Cameras', icon: Camera },
      { href: '/production-lines', label: 'Production Lines', icon: Factory },
    ],
  },
  {
    label: 'SAFETY',
    items: [
      { href: '/safety-zones', label: 'Safety Zones', icon: ShieldAlert },
      { href: '/employees', label: 'Employees', icon: Users },
      { href: '/forklifts', label: 'Forklifts', icon: Truck },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
      { href: '/reports', label: 'Reports', icon: FileText },
      { href: '/audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/user-management', label: 'User Management', icon: UserCog },
    ],
  },
];

const FACILITIES = [
  { id: 'kck', label: 'Kansas City, KS (KCK)' },
  { id: 'liberal', label: 'Liberal, KS' },
  { id: 'dodge', label: 'Dodge City, KS' },
  { id: 'tama', label: 'Tama, IA' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const pathname = usePathname();

  const sidebarClass = [
    styles.sidebar,
    collapsed ? styles.collapsed : '',
    mobileOpen ? styles.mobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.visible : ''}`}
        onClick={onMobileClose}
      />

      <aside className={sidebarClass}>
        {/* Brand */}
        <div className={styles.brandArea}>
          <div className={styles.brandMark}>NB</div>
          <span className={styles.brandName}>National Beef AI</span>
        </div>

        {/* Facility Selector */}
        <div className={styles.facilitySelector}>
          <select
            className={styles.facilitySelect}
            defaultValue="kck"
            aria-label="Select facility"
          >
            {FACILITIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className={styles.section}>
              <div className={styles.sectionLabel}>{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                    onClick={onMobileClose}
                  >
                    <span className={styles.navIcon}>
                      <Icon size={20} />
                    </span>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.tooltip}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <button
          className={styles.toggleBtn}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
        </button>
      </aside>
    </>
  );
}
