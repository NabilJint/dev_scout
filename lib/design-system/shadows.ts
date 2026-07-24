import type { ShadowScale } from './types';

export const shadows: Record<ShadowScale, string> = {
  sm: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0px 4px 12px rgba(0, 0, 0, 0.08)',
  lg: '0px 12px 24px rgba(0, 0, 0, 0.12)',
  xl: '0px 24px 48px rgba(0, 0, 0, 0.16)',
};
