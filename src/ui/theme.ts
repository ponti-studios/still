import { useColorScheme } from 'react-native';
import type { Status } from '../core/types';

export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  lineSoft: string;
  green: string;
  greenDark: string;
  greenTint: string;
  danger: string;
  link: string;
};

/** Still's palette, light first. Dark is designed, not inverted. */
const light: Palette = {
  bg: '#f7f7f4',
  surface: '#ffffff',
  ink: '#282b27',
  muted: '#5d6059',
  faint: '#6b6e67',
  line: '#eaeae4',
  lineSoft: '#f2f2ee',
  green: '#344b3e',
  greenDark: '#263d31',
  greenTint: '#edf0e9',
  danger: '#b3453b',
  link: '#53684c',
} as const;

const dark: Palette = {
  bg: '#141613',
  surface: '#1f211d',
  ink: '#f0f1ea',
  muted: '#a9aca1',
  faint: '#86897f',
  line: '#2e312b',
  lineSoft: '#242723',
  green: '#8fae97',
  greenDark: '#6e8f77',
  greenTint: '#222b23',
  danger: '#e08073',
  link: '#a9c2ab',
} as const;

/** The static light palette for non-component contexts. Components use useColors(). */
export const colors: Palette = light;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const thumbColors: Record<string, string> = {
  sand: '#f4ecdc',
  blue: '#e3ecf3',
  yellow: '#f8f1d3',
  green: '#e2eddc',
  pink: '#f6e4e4',
  lavender: '#ebe7f3',
  peach: '#f8e6d8',
  mint: '#dcf0e8',
};

const lightBadges: Record<Status, { bg: string; fg: string; dot: string }> = {
  Owned: { bg: '#eff3ec', fg: '#667162', dot: '#88a17f' },
  Wanted: { bg: '#f7f0df', fg: '#7f6b40', dot: '#c4a65f' },
  Planned: { bg: '#edf0f1', fg: '#5f6f73', dot: '#91a6aa' },
  Ordered: { bg: '#eaf0f4', fg: '#5b6f7a', dot: '#88a7b9' },
  Delivered: { bg: '#f0ede6', fg: '#736a56', dot: '#b3a88a' },
  Archived: { bg: '#f1f1ef', fg: '#6e6e6e', dot: '#aaaaaa' },
};

const darkBadges: Record<Status, { bg: string; fg: string; dot: string }> = {
  Owned: { bg: '#263026', fg: '#b9d6bb', dot: '#88a17f' },
  Wanted: { bg: '#342e1e', fg: '#e3c98f', dot: '#c4a65f' },
  Planned: { bg: '#232f34', fg: '#aecbd4', dot: '#91a6aa' },
  Ordered: { bg: '#232e3a', fg: '#aec9d8', dot: '#88a7b9' },
  Delivered: { bg: '#342e22', fg: '#dcc99c', dot: '#b3a88a' },
  Archived: { bg: '#2a2c28', fg: '#b2b5ac', dot: '#aaaaaa' },
};

/** Static light badges for non-component contexts. Components use useBadgeColors(). */
export const badgeColors = lightBadges;

export function useBadgeColors() {
  return useColorScheme() === 'dark' ? darkBadges : lightBadges;
}

/** One spacing scale. No magic numbers in layouts. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** One radius scale. Cards lg, sheets xl, pills full. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

/** One type scale: size, weight, line height travel together. */
export const type = {
  display: { fontSize: 34, fontWeight: '800', lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontSize: 26, fontWeight: '800', lineHeight: 32, letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '800', lineHeight: 26, letterSpacing: -0.4 },
  headline: { fontSize: 17, fontWeight: '700', lineHeight: 22, letterSpacing: -0.2 },
  subhead: { fontSize: 15, fontWeight: '600', lineHeight: 20, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, letterSpacing: 0 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0.1 },
  micro: { fontSize: 10, fontWeight: '700', lineHeight: 14, letterSpacing: 0.6 },
} as const;
