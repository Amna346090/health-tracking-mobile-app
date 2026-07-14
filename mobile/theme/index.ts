// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary: '#4f46e5',       // indigo-600
  primaryDark: '#4338ca',   // indigo-700 (pressed state)
  primaryBg: '#eef2ff',     // indigo-50

  // Semantic
  success: '#059669',
  successBg: '#ecfdf5',
  warning: '#d97706',
  warningBg: '#fffbeb',
  danger: '#dc2626',
  dangerBg: '#fef2f2',

  // Text
  text: {
    primary: '#111827',    // gray-900
    secondary: '#6b7280',  // gray-500
    muted: '#9ca3af',      // gray-400
    inverse: '#ffffff',
    link: '#4f46e5',
  },

  // Surfaces
  bg: {
    app: '#f9fafb',     // gray-50
    card: '#ffffff',
    subtle: '#f3f4f6',  // gray-100
    input: '#f9fafb',
  },

  border: '#e5e7eb',     // gray-200
  borderFocus: '#4f46e5',
} as const;

// ─── Spacing (4-pt grid) ──────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  h1:      { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2:      { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  h3:      { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  h4:      { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  body1:   { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body2:   { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  label:   { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
