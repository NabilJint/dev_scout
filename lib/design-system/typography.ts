import type { FontFamily, FontSize, FontWeight, LineHeight, TypographyToken } from './types';

export const fontFamily: FontFamily = {
  primary: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', 'SF Mono', 'Fira Code', monospace",
};

export const fontSizes: Record<FontSize, TypographyToken> = {
  h1: { size: '2rem', weight: 700, lineHeight: 1.2 },
  h2: { size: '1.5rem', weight: 600, lineHeight: 1.3 },
  h3: { size: '1.25rem', weight: 600, lineHeight: 1.3 },
  h4: { size: '1rem', weight: 500, lineHeight: 1.4 },
  'body-lg': { size: '1rem', weight: 400, lineHeight: 1.6 },
  'body-md': { size: '0.875rem', weight: 400, lineHeight: 1.6 },
  'body-sm': { size: '0.8125rem', weight: 400, lineHeight: 1.6 },
  caption: { size: '0.6875rem', weight: 400, lineHeight: 1.4 },
};

export const fontWeights: Record<FontWeight, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const lineHeights: Record<LineHeight, number> = {
  tight: 1.2,
  snug: 1.3,
  normal: 1.4,
  relaxed: 1.6,
};
