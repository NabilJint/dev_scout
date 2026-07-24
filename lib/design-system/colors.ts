import type { BrandColors, SemanticColors, ColorScale, TextColors, BorderColors } from './types';

export const brandColors: BrandColors = {
  primary: {
    base: '#6366F1',
    muted: 'rgba(99, 102, 241, 0.16)',
    hover: '#5558E6',
    active: '#4F46E5',
  },
  secondary: {
    base: '#64748B',
    muted: 'rgba(100, 116, 139, 0.16)',
    hover: '#5A6A80',
    active: '#475569',
  },
  surface: '#111827',
  surfaceElevated: '#1F2937',
  background: '#080D12',
};

export const semanticColors: SemanticColors = {
  positive: {
    base: '#10B981',
    muted: 'rgba(16, 185, 129, 0.16)',
  },
  warning: {
    base: '#F59E0B',
    muted: 'rgba(245, 158, 11, 0.16)',
  },
  negative: {
    base: '#EF4444',
    muted: 'rgba(239, 68, 68, 0.16)',
  },
  info: {
    base: '#3B82F6',
    muted: 'rgba(59, 130, 246, 0.16)',
  },
};

export const neutralColors: ColorScale = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#374151',
  700: '#1F2937',
  800: '#111827',
  900: '#080D12',
};

export const textColors: TextColors = {
  primary: '#F9FAFB',
  secondary: '#9CA3AF',
  muted: '#6B7280',
  inverse: '#080D12',
};

export const borderColors: BorderColors = {
  default: '#374151',
  subtle: '#1F2937',
  strong: '#6B7280',
  focus: '#6366F1',
};
