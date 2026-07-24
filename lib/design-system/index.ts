export * from './types';
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './radius';

// Convenience re-exports
import { brandColors, semanticColors, neutralColors, textColors, borderColors } from './colors';
import { fontFamily, fontSizes } from './typography';
import { spacing, grid } from './spacing';
import { shadows } from './shadows';
import { radius } from './radius';
import type { DesignSystem } from './types';

export const designSystem: DesignSystem = {
  colors: {
    brand: brandColors,
    semantic: semanticColors,
    neutral: neutralColors,
    text: textColors,
    border: borderColors,
  },
  typography: {
    fontFamily,
    scale: fontSizes,
  },
  spacing,
  shadows,
  radius,
  grid,
  zIndex: {
    base: 0,
    dropdown: 50,
    sticky: 100,
    overlay: 200,
    modal: 300,
    toast: 400,
  },
  transition: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',
  },
};
