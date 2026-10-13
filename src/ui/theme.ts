import type { Status } from '../core/types';

// Still's palette, carried over from the web app.
export const colors = {
  bg: '#f7f7f4',
  surface: '#ffffff',
  ink: '#282b27',
  muted: '#82857e',
  faint: '#a5a69f',
  line: '#eaeae4',
  lineSoft: '#f2f2ee',
  green: '#344b3e',
  greenDark: '#263d31',
  greenTint: '#edf0e9',
  danger: '#b3453b',
  link: '#53684c',
} as const;

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

export const badgeColors: Record<Status, { bg: string; fg: string; dot: string }> = {
  Owned: { bg: '#eff3ec', fg: '#697565', dot: '#88a17f' },
  Wanted: { bg: '#f7f0df', fg: '#9b824e', dot: '#c4a65f' },
  Planned: { bg: '#edf0f1', fg: '#6f8186', dot: '#91a6aa' },
  Ordered: { bg: '#eaf0f4', fg: '#6f8795', dot: '#88a7b9' },
  Delivered: { bg: '#f0ede6', fg: '#8b8068', dot: '#b3a88a' },
  Archived: { bg: '#f1f1ef', fg: '#999999', dot: '#aaaaaa' },
};
