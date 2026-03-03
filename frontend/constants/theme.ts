export const Colors = {
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  accent: '#f59e0b',
  background: '#f0f4f8',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  success: '#16a34a',
  successBg: '#dcfce7',
  error: '#dc2626',
  errorBg: '#fee2e2',
  warning: '#d97706',
  warningBg: '#fef3c7',
  info: '#2563eb',
  infoBg: '#dbeafe',
  win: '#15803d',
  winBg: '#bbf7d0',
} as const;

export const Typography = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;
