/**
 * Branding configuration — interchangeable per company/organization.
 * Colors, logo, fonts can be swapped at runtime or per-tenant.
 */

export const defaultBranding = {
  companyName: 'National Beef',
  tagline: "America's Premier Beef Company®",
  logoUrl: 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg',
  logoAlt: 'National Beef Logo',
  // Logo has white text — needs a dark background or use logoDarkUrl for light mode
  logoDarkUrl: null, // optional: a dark version of the logo for light backgrounds
  faviconUrl: 'https://www.nationalbeef.com/wp-content/uploads/2026/02/nb-favicon.svg',
  colors: {
    primary: '#002D72',      // Midnight navy
    primaryLight: '#194280',
    accent: '#009DD9',       // Cerulean blue
    accentLight: '#19ACE3',
    darkBlue: '#001639',
    error: '#BF0000',
    warning: '#F59E0B',
    success: '#10B981',
  },
  fonts: {
    body: "'Open Sans', sans-serif",
    heading: "'Nunito', sans-serif",
  },
};

/**
 * Apply branding overrides to the document root CSS custom properties.
 * Call this on app init or when switching organizations.
 *
 * @param {object} branding - Partial branding config to merge with defaults
 */
export function applyBranding(branding = {}) {
  if (typeof document === 'undefined') return;

  const merged = {
    ...defaultBranding,
    ...branding,
    colors: { ...defaultBranding.colors, ...(branding.colors || {}) },
    fonts: { ...defaultBranding.fonts, ...(branding.fonts || {}) },
  };

  const root = document.documentElement;

  // Brand color tokens
  root.style.setProperty('--brand-primary', merged.colors.primary);
  root.style.setProperty('--brand-primary-light', merged.colors.primaryLight);
  root.style.setProperty('--brand-accent', merged.colors.accent);
  root.style.setProperty('--brand-accent-light', merged.colors.accentLight);
  root.style.setProperty('--brand-dark', merged.colors.darkBlue);

  // Update semantic tokens that reference brand
  root.style.setProperty('--color-primary', merged.colors.primary);
  root.style.setProperty('--color-primary-hover', merged.colors.primaryLight);
  root.style.setProperty('--color-accent', merged.colors.accent);
  root.style.setProperty('--color-accent-hover', merged.colors.accentLight);
  root.style.setProperty('--color-sidebar-bg', merged.colors.darkBlue);

  // Fonts
  root.style.setProperty('--font-body', merged.fonts.body);
  root.style.setProperty('--font-heading', merged.fonts.heading);

  return merged;
}

/**
 * Get current branding — in a multi-tenant app this would
 * fetch from the organization's branding config in the DB.
 * For now returns defaults.
 */
export function getBranding(orgId = null) {
  // TODO: Fetch from Vantage API /api/vantage/branding?orgId=...
  return defaultBranding;
}
