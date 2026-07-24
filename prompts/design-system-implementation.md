# Design System Implementation Prompt

## Goal

Implement a comprehensive design system for DevScout AI based on the provided UI reference specifications. This establishes the visual foundation for all UI work — colors, typography, spacing, shadows, border radius, and component tokens. The design system must be implemented using Tailwind CSS v4 (CSS-based configuration) and prepare for shadcn/ui integration.

## Assigned Specialist Agent(s)

- **UI/UX Designer** — Design token decisions, visual hierarchy, component styling patterns
- **Frontend Engineer** — Tailwind configuration, CSS variables, TypeScript types, component updates

## Skills Read

- `ui-styling` — Tailwind CSS, shadcn/ui, CSS variables, design tokens
- `design-system` — Token architecture, component specifications, CSS variables
- `brand` — Brand identity, visual consistency
- `frontend-design` — Production-grade frontend interfaces

## Existing Code Inspected

- `app/globals.css` — Current CSS setup (minimal, uses Tailwind v4 `@import "tailwindcss"`)
- `app/layout.tsx` — Root layout with Geist fonts (will be replaced with Inter)
- `app/page.tsx` — Home page (default Next.js template, will be rebuilt)
- `package.json` — Tailwind v4, Next.js 16, React 19
- `postcss.config.mjs` — PostCSS with `@tailwindcss/postcss`
- `tsconfig.json` — TypeScript config with `@/*` path alias
- `ui_ref/` — Design reference images (home_page.png, details_page.png, ui reference.png)

## Decisions and Assumptions

1. **Tailwind v4 uses CSS-based configuration** — No `tailwind.config.ts` file. All design tokens are defined in `globals.css` using `@theme` blocks and CSS custom properties.
2. **Inter font replaces Geist** — The UI reference specifies Inter as the primary font family. Geist fonts will be removed from `layout.tsx`.
3. **Dark theme is primary** — The UI reference shows a dark-themed interface. Light mode support is secondary and can be added later.
4. **shadcn/ui will be installed separately** — This prompt sets up the design tokens and CSS variables that shadcn/ui will consume. The actual `npx shadcn@latest init` and component installation happens in a follow-up task.
5. **No component creation in this task** — This task focuses solely on the design system foundation (tokens, variables, types). Actual UI components (ToolCard, SearchBar, etc.) are built in subsequent prompts.
6. **Path alias `@/*` is already configured** — Use `@/lib/design-system/` for design token exports.

## Files Likely to Change

| File | Action | Description |
|------|--------|-------------|
| `app/globals.css` | **Rewrite** | Complete design token system using Tailwind v4 `@theme` and CSS custom properties |
| `app/layout.tsx` | **Update** | Replace Geist fonts with Inter, update metadata for DevScout AI |
| `lib/design-system/index.ts` | **Create** | TypeScript exports for all design tokens |
| `lib/design-system/colors.ts` | **Create** | Color token definitions and semantic mappings |
| `lib/design-system/typography.ts` | **Create** | Typography scale and font configurations |
| `lib/design-system/spacing.ts` | **Create** | Spacing scale and layout tokens |
| `lib/design-system/shadows.ts` | **Create** | Shadow definitions |
| `lib/design-system/radius.ts` | **Create** | Border radius tokens |
| `lib/design-system/types.ts` | **Create** | TypeScript types for all design tokens |
| `tailwind.config.ts` | **Do not create** | Tailwind v4 does not use this file |

## Implementation Requirements

### 1. CSS Design Tokens (`app/globals.css`)

Rewrite `globals.css` to establish the complete design token system using Tailwind v4's CSS-based configuration:

```css
@import "tailwindcss";

/* ============================================
   DEVSCOUT AI DESIGN SYSTEM
   Design System v1.0 — May 31, 2026
   ============================================ */

/* --------------------------------------------
   BRAND TOKENS
   -------------------------------------------- */

:root {
  /* Primary Colors */
  --color-primary: #6366F1;
  --color-primary-hover: #5558E6;
  --color-primary-active: #4F46E5;
  --color-primary-muted: rgba(99, 102, 241, 0.16);

  --color-secondary: #64748B;
  --color-secondary-hover: #5A6A80;
  --color-secondary-active: #475569;

  --color-surface: #111827;
  --color-surface-elevated: #1F2937;
  --color-background: #080D12;

  /* Semantic Colors */
  --color-positive: #10B981;
  --color-positive-muted: rgba(16, 185, 129, 0.16);
  --color-warning: #F59E0B;
  --color-warning-muted: rgba(245, 158, 11, 0.16);
  --color-negative: #EF4444;
  --color-negative-muted: rgba(239, 68, 68, 0.16);
  --color-info: #3B82F6;
  --color-info-muted: rgba(59, 130, 246, 0.16);

  /* Neutral Colors */
  --color-n-900: #080D12;
  --color-n-800: #111827;
  --color-n-700: #1F2937;
  --color-n-600: #374151;
  --color-n-500: #6B7280;
  --color-n-400: #9CA3AF;
  --color-n-300: #D1D5DB;
  --color-n-200: #E5E7EB;
  --color-n-100: #F3F4F6;
  --color-n-50: #F9FAFB;

  /* Text Colors */
  --color-text-primary: #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-text-muted: #6B7280;
  --color-text-inverse: #080D12;

  /* Border Colors */
  --color-border-default: #374151;
  --color-border-subtle: #1F2937;
  --color-border-strong: #6B7280;
  --color-border-focus: #6366F1;

  /* Typography Scale */
  --font-family-primary: 'Inter', system-ui, -apple-system, sans-serif;
  --font-family-mono: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;

  --font-size-h1: 2rem;        /* 32px */
  --font-size-h2: 1.5rem;      /* 24px */
  --font-size-h3: 1.25rem;     /* 20px */
  --font-size-h4: 1rem;        /* 16px */
  --font-size-body-lg: 1rem;   /* 16px */
  --font-size-body-md: 0.875rem; /* 14px */
  --font-size-body-sm: 0.8125rem; /* 13px */
  --font-size-caption: 0.6875rem;  /* 11px */

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.2;
  --line-height-snug: 1.3;
  --line-height-normal: 1.4;
  --line-height-relaxed: 1.6;

  /* Spacing Scale (4px base unit) */
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.5rem;    /* 24px */
  --spacing-6: 2rem;      /* 32px */
  --spacing-7: 2.5rem;    /* 40px */
  --spacing-8: 3rem;      /* 48px */
  --spacing-10: 5rem;     /* 80px */

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0px 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0px 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0px 12px 24px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0px 24px 48px rgba(0, 0, 0, 0.16);

  /* Grid System */
  --grid-container: 1280px;
  --grid-columns: 12;
  --grid-gutter: 1.5rem;   /* 24px */
  --grid-margin: 1.5rem;   /* 24px */

  /* Z-Index Scale */
  --z-base: 0;
  --z-dropdown: 50;
  --z-sticky: 100;
  --z-overlay: 200;
  --z-modal: 300;
  --z-toast: 400;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}

/* --------------------------------------------
   TAILWIND v4 THEME EXTENSION
   Maps CSS variables to Tailwind utilities
   -------------------------------------------- */

@theme inline {
  /* Colors */
  --color-primary: var(--color-primary);
  --color-primary-hover: var(--color-primary-hover);
  --color-primary-active: var(--color-primary-active);
  --color-primary-muted: var(--color-primary-muted);

  --color-secondary: var(--color-secondary);
  --color-secondary-hover: var(--color-secondary-hover);
  --color-secondary-active: var(--color-secondary-active);

  --color-surface: var(--color-surface);
  --color-surface-elevated: var(--color-surface-elevated);
  --color-background: var(--color-background);

  --color-positive: var(--color-positive);
  --color-positive-muted: var(--color-positive-muted);
  --color-warning: var(--color-warning);
  --color-warning-muted: var(--color-warning-muted);
  --color-negative: var(--color-negative);
  --color-negative-muted: var(--color-negative-muted);
  --color-info: var(--color-info);
  --color-info-muted: var(--color-info-muted);

  --color-n-900: var(--color-n-900);
  --color-n-800: var(--color-n-800);
  --color-n-700: var(--color-n-700);
  --color-n-600: var(--color-n-600);
  --color-n-500: var(--color-n-500);
  --color-n-400: var(--color-n-400);
  --color-n-300: var(--color-n-300);
  --color-n-200: var(--color-n-200);
  --color-n-100: var(--color-n-100);
  --color-n-50: var(--color-n-50);

  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted: var(--color-text-muted);
  --color-text-inverse: var(--color-text-inverse);

  --color-border-default: var(--color-border-default);
  --color-border-subtle: var(--color-border-subtle);
  --color-border-strong: var(--color-border-strong);
  --color-border-focus: var(--color-border-focus);

  /* Font Family */
  --font-family-primary: var(--font-family-primary);
  --font-family-mono: var(--font-family-mono);

  /* Font Sizes */
  --font-size-h1: var(--font-size-h1);
  --font-size-h2: var(--font-size-h2);
  --font-size-h3: var(--font-size-h3);
  --font-size-h4: var(--font-size-h4);
  --font-size-body-lg: var(--font-size-body-lg);
  --font-size-body-md: var(--font-size-body-md);
  --font-size-body-sm: var(--font-size-body-sm);
  --font-size-caption: var(--font-size-caption);

  /* Font Weights */
  --font-weight-regular: var(--font-weight-regular);
  --font-weight-medium: var(--font-weight-medium);
  --font-weight-semibold: var(--font-weight-semibold);
  --font-weight-bold: var(--font-weight-bold);

  /* Line Heights */
  --line-height-tight: var(--line-height-tight);
  --line-height-snug: var(--line-height-snug);
  --line-height-normal: var(--line-height-normal);
  --line-height-relaxed: var(--line-height-relaxed);

  /* Spacing */
  --spacing-1: var(--spacing-1);
  --spacing-2: var(--spacing-2);
  --spacing-3: var(--spacing-3);
  --spacing-4: var(--spacing-4);
  --spacing-5: var(--spacing-5);
  --spacing-6: var(--spacing-6);
  --spacing-7: var(--spacing-7);
  --spacing-8: var(--spacing-8);
  --spacing-10: var(--spacing-10);

  /* Border Radius */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --radius-full: var(--radius-full);

  /* Shadows */
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
}

/* --------------------------------------------
   BASE STYLES
   -------------------------------------------- */

body {
  background-color: var(--color-background);
  color: var(--color-text-primary);
  font-family: var(--font-family-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Focus styles */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-n-800);
}

::-webkit-scrollbar-thumb {
  background: var(--color-n-600);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-n-500);
}
```

### 2. TypeScript Types (`lib/design-system/types.ts`)

Create comprehensive TypeScript types for all design tokens:

```typescript
// Color tokens
export type ColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export type SemanticColor = {
  base: string;
  muted: string;
  hover?: string;
  active?: string;
};

export type BrandColors = {
  primary: SemanticColor;
  secondary: SemanticColor;
  surface: string;
  surfaceElevated: string;
  background: string;
};

export type SemanticColors = {
  positive: SemanticColor;
  warning: SemanticColor;
  negative: SemanticColor;
  info: SemanticColor;
};

export type TextColors = {
  primary: string;
  secondary: string;
  muted: string;
  inverse: string;
};

export type BorderColors = {
  default: string;
  subtle: string;
  strong: string;
  focus: string;
};

// Typography tokens
export type FontFamily = {
  primary: string;
  mono: string;
};

export type FontSize =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type LineHeight = 'tight' | 'snug' | 'normal' | 'relaxed';

export type TypographyToken = {
  size: string;
  weight: number;
  lineHeight: number;
};

// Spacing tokens
export type SpacingScale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;

// Shadow tokens
export type ShadowScale = 'sm' | 'md' | 'lg' | 'xl';

// Border radius tokens
export type RadiusScale = 'sm' | 'md' | 'lg' | 'xl' | 'full';

// Grid tokens
export type GridConfig = {
  container: string;
  columns: number;
  gutter: string;
  margin: string;
};

// Z-index tokens
export type ZIndexScale = 'base' | 'dropdown' | 'sticky' | 'overlay' | 'modal' | 'toast';

// Transition tokens
export type TransitionScale = 'fast' | 'normal' | 'slow';

// Complete design system types
export type DesignSystem = {
  colors: {
    brand: BrandColors;
    semantic: SemanticColors;
    neutral: ColorScale;
    text: TextColors;
    border: BorderColors;
  };
  typography: {
    fontFamily: FontFamily;
    scale: Record<FontSize, TypographyToken>;
  };
  spacing: Record<SpacingScale, string>;
  shadows: Record<ShadowScale, string>;
  radius: Record<RadiusScale, string>;
  grid: GridConfig;
  zIndex: Record<ZIndexScale, number>;
  transition: Record<TransitionScale, string>;
};

// Component token types
export type ButtonVariant = 'primary' | 'secondary' | 'text';
export type ButtonState = 'default' | 'hover' | 'outline' | 'disabled';
export type ChipVariant = 'default' | 'primary' | 'positive' | 'warning' | 'negative' | 'info';
export type ToolScoreLevel = 'excellent' | 'average' | 'poor';
```

### 3. Design Token Modules (`lib/design-system/`)

Create individual token modules that export typed constants:

**`lib/design-system/colors.ts`**
```typescript
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
```

**`lib/design-system/typography.ts`**
```typescript
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
```

**`lib/design-system/spacing.ts`**
```typescript
import type { SpacingScale } from './types';

export const spacing: Record<SpacingScale, string> = {
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.5rem',    // 24px
  6: '2rem',      // 32px
  7: '2.5rem',    // 40px
  8: '3rem',      // 48px
  10: '5rem',     // 80px
};

export const grid = {
  container: '1280px',
  columns: 12,
  gutter: '1.5rem',
  margin: '1.5rem',
};
```

**`lib/design-system/shadows.ts`**
```typescript
import type { ShadowScale } from './types';

export const shadows: Record<ShadowScale, string> = {
  sm: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0px 4px 12px rgba(0, 0, 0, 0.08)',
  lg: '0px 12px 24px rgba(0, 0, 0, 0.12)',
  xl: '0px 24px 48px rgba(0, 0, 0, 0.16)',
};
```

**`lib/design-system/radius.ts`**
```typescript
import type { RadiusScale } from './types';

export const radius: Record<RadiusScale, string> = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
};
```

**`lib/design-system/index.ts`**
```typescript
export * from './types';
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './radius';

// Convenience re-exports
import { brandColors, semanticColors, neutralColors, textColors, borderColors } from './colors';
import { fontFamily, fontSizes, fontWeights, lineHeights } from './typography';
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
```

### 4. Layout Updates (`app/layout.tsx`)

Update the root layout to use Inter font and DevScout AI metadata:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevScout AI — Developer Tools Discovery Platform",
  description: "Discover, analyze, and compare the best developer tools with AI-powered insights.",
  keywords: ["developer tools", "AI", "code editor", "backend", "frontend", "DevOps"],
  openGraph: {
    title: "DevScout AI",
    description: "Developer Tools Discovery Platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text-primary font-primary">
        {children}
      </body>
    </html>
  );
}
```

## Security Requirements

- No security concerns for this task. Design tokens are public configuration.
- No secrets, API keys, or credentials are involved.

## Acceptance Criteria

- [ ] `app/globals.css` contains all design tokens using Tailwind v4 `@theme` blocks
- [ ] CSS custom properties are defined for colors, typography, spacing, shadows, and radius
- [ ] Tailwind utility classes work with the new tokens (e.g., `bg-primary`, `text-text-secondary`, `shadow-md`)
- [ ] `lib/design-system/` directory contains typed token modules
- [ ] TypeScript types accurately represent all design tokens
- [ ] `app/layout.tsx` uses Inter font family
- [ ] `app/layout.tsx` has DevScout AI metadata
- [ ] No TypeScript errors in design system files
- [ ] No ESLint errors in design system files
- [ ] Build succeeds with the new design tokens

## Checks to Run

After implementation, run these checks and report results:

```bash
# TypeScript check
npm run typecheck

# ESLint check
npm run lint

# Production build (verify tokens don't break build)
npm run build
```

## Manual Test Steps

1. **Start dev server**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Verify dark theme**: Background should be very dark blue-black (#080D12)
4. **Verify text colors**: Text should be light (#F9FAFB) on dark background
5. **Verify Inter font**: Check DevTools → Computed → font-family shows Inter
6. **Verify Tailwind utilities work**:
   - Add `class="bg-primary p-4 text-white"` to any element → should show indigo/purple background
   - Add `class="shadow-lg"` → should show large shadow
   - Add `class="rounded-lg"` → should show 16px border radius
7. **Verify CSS variables**: Open DevTools → Elements → :root → confirm all `--color-*` variables are defined

### 5. Design System Showcase Page (`app/showcase/page.tsx`)

Create a comprehensive visual showcase page that displays all design system elements. This page serves as a living reference for the design system and helps verify all tokens are correctly implemented.

#### Showcase Page Requirements

The showcase page must display the following sections in order:

1. **Color Palette** — All color tokens (primary, semantic, neutral) with swatches and hex values
2. **Typography Scale** — All font sizes (H1-H4, Body, Caption) with samples
3. **Spacing Scale** — Visual blocks showing 4px base unit scale (4, 8, 12, 16, 24, 32, 40, 48, 80px)
4. **Shadows** — Sample cards with shadow-sm, shadow-md, shadow-lg, shadow-xl
5. **Border Radius** — Elements showing sm(6px), md(10px), lg(16px), xl(20px), full(9999px)
6. **Buttons** — Primary, Secondary, Text buttons with Default, Hover, Outline, Disabled states
7. **Chips/Category Tags** — Sample chips (AI Tools, AI Code, Backend, DevOps, More)
8. **Tool Score Display** — Excellent/Average/Poor gradient bar
9. **Icons** — Sample icons in line style, 2px stroke, 24x24 grid

#### Visual Layout

- Dark background (#080D12) with sections separated by dividers
- Each section has a heading, description, and visual examples
- Responsive: works on mobile (375px), tablet (768px), desktop (1280px+)
- Uses only design system tokens (no hardcoded values)
- Interactive button states: default, hover, outline, disabled

#### Implementation Notes

- Server component (no client-side JavaScript needed)
- Uses only Tailwind utility classes with design tokens
- Icons are simple inline SVGs (no icon library dependency)
- Tool score gradient bar uses CSS gradients with semantic colors

## Follow-Up Tasks

This design system implementation enables:

1. **shadcn/ui Installation** — `npx shadcn@latest init` (will consume the CSS variables)
2. **Component Library** — Build ToolCard, SearchBar, CategoryChip, etc. using these tokens
3. **Page Implementation** — Home page, Details page, Search page using the design system

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-18 | Prompt Engineer | Initial design system implementation prompt |
