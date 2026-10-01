'use client';

import { createTheme, type ThemeOptions, alpha } from '@mui/material/styles';

/**
 * Single source of truth for the visual language.
 *
 * Design tokens (colour, radius, elevation, typography) are declared once and
 * every component reads them from the theme - no hard-coded hex values are
 * allowed in feature code (DRY). Light and dark palettes share the same token
 * names so switching modes never requires component changes.
 */

export const brand = {
  primary: '#0F766E',
  secondary: '#2563EB',
  accent: '#E85D3F',
  success: '#10B981',
  danger: '#EF4444',
};

const shared: ThemeOptions = {
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'var(--font-sans), "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 800, letterSpacing: 0, fontSize: '2.6rem' },
    h2: { fontWeight: 800, letterSpacing: 0, fontSize: '2rem' },
    h3: { fontWeight: 700, letterSpacing: 0, fontSize: '1.6rem' },
    h4: { fontWeight: 700, fontSize: '1.3rem' },
    h5: { fontWeight: 700, fontSize: '1.1rem' },
    h6: { fontWeight: 700, fontSize: '1rem' },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, paddingInline: 18 } },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none',
          transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            borderColor: alpha(theme.palette.primary.main, 0.5),
            boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.14)}`,
          },
        }),
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backdropFilter: 'blur(12px)',
          backgroundColor: alpha(theme.palette.background.default, 0.8),
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }),
      },
    },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999, height: 8 } } },
  },
};

export const buildTheme = (mode: 'light' | 'dark') =>
  createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: brand.primary },
      secondary: { main: brand.secondary },
      warning: { main: brand.accent },
      success: { main: brand.success },
      error: { main: brand.danger },
      ...(mode === 'light'
        ? {
            background: { default: '#F6F7FB', paper: '#FFFFFF' },
            text: { primary: '#111827', secondary: '#5B6478' },
            divider: '#E5E7EB',
          }
        : {
            background: { default: '#0B1020', paper: '#141A2E' },
            text: { primary: '#F3F4F6', secondary: '#9AA4BF' },
            divider: '#243049',
          }),
    },
  });

/** Colour coding applied consistently to every entity type across the app. */
export const entityStyle: Record<string, { label: string; color: 'primary' | 'secondary' | 'warning' | 'success' | 'info' | 'default' }> = {
  EVENT: { label: 'Event', color: 'primary' },
  RESOURCE: { label: 'Resource', color: 'secondary' },
  ANNOUNCEMENT: { label: 'Announcement', color: 'warning' },
  POST: { label: 'Discussion', color: 'info' },
  COMMUNITY: { label: 'Community', color: 'success' },
  PROFILE: { label: 'Member', color: 'default' },
  PROJECT: { label: 'Project', color: 'warning' },
};
