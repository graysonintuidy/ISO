'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  MapPin,
  ChevronDown,
  Check,
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
  { id: 'kck', label: 'Kansas City, KS (KCK)', short: 'KCK' },
  { id: 'liberal', label: 'Liberal, KS', short: 'LBL' },
  { id: 'dodge', label: 'Dodge City, KS', short: 'DDG' },
  { id: 'tama', label: 'Tama, IA', short: 'TMA' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const pathname = usePathname();
  const [selectedFacility, setSelectedFacility] = useState('kck');
  const [facilityOpen, setFacilityOpen] = useState(false);
  const facilityRef = useRef(null);

  const currentFacility = FACILITIES.find((f) => f.id === selectedFacility);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (facilityRef.current && !facilityRef.current.contains(e.target)) {
        setFacilityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when sidebar collapse state changes
  useEffect(() => {
    setFacilityOpen(false);
  }, [collapsed]);

  const handleFacilitySelect = useCallback((id) => {
    setSelectedFacility(id);
    setFacilityOpen(false);
  }, []);

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

        {/* Facility Selector — custom dropdown */}
        <div className={styles.facilitySelector} ref={facilityRef}>
          <button
            className={styles.facilityBtn}
            onClick={() => setFacilityOpen((prev) => !prev)}
            aria-label="Select facility"
            aria-expanded={facilityOpen}
            type="button"
          >
            <MapPin size={16} className={styles.facilityIcon} />
            <span className={styles.facilityLabel}>{currentFacility?.label}</span>
            <ChevronDown
              size={14}
              className={`${styles.facilityChevron} ${facilityOpen ? styles.chevronOpen : ''}`}
            />
          </button>

          {facilityOpen && (
            <div className={styles.facilityDropdown}>
              <div className={styles.facilityDropdownHeader}>Select Facility</div>
              {FACILITIES.map((f) => (
                <button
                  key={f.id}
                  className={`${styles.facilityOption} ${f.id === selectedFacility ? styles.facilityOptionActive : ''}`}
                  onClick={() => handleFacilitySelect(f.id)}
                  type="button"
                >
                  <span className={styles.facilityOptionLabel}>{f.label}</span>
                  {f.id === selectedFacility && <Check size={14} className={styles.facilityCheck} />}
                </button>
              ))}
            </div>
          )}
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
