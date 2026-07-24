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
