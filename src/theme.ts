export const colors = {
  background: '#0F0809',
  surface: '#1C1314',
  surfaceElevated: '#281C1E',
  border: '#312324',
  textPrimary: '#f2ede8',
  textSecondary: '#c8bcae',
  textMuted: '#8a7e72',
  primary: '#ff6b35',
  primaryDim: '#b34a25',
  secondary: '#e8756a',
  highlight: '#ffb347',
  danger: '#ff5a52',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, color: colors.textPrimary },
  title: { fontSize: 22, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
} as const;
