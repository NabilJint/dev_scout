export default function ShowcasePage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-16">
        {/* Header */}
        <section className="space-y-4">
          <h1 className="text-h1 font-bold text-text-primary">
            DevScout AI Design System
          </h1>
          <p className="text-body-lg text-text-secondary">
            Visual reference for all design tokens and components
          </p>
        </section>

        {/* 1. Color Palette */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              1. Color Palette
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Brand, semantic, and neutral color tokens
            </p>
          </div>

          {/* Primary Colors */}
          <div className="space-y-3">
            <h3 className="text-h4 font-medium text-text-secondary">
              Primary
            </h3>
            <div className="flex flex-wrap gap-3">
              <ColorSwatch name="Primary" value="#6366F1" />
              <ColorSwatch name="Hover" value="#5558E6" />
              <ColorSwatch name="Active" value="#4F46E5" />
              <ColorSwatch
                name="Muted"
                value="rgba(99, 102, 241, 0.16)"
              />
            </div>
          </div>

          {/* Semantic Colors */}
          <div className="space-y-3">
            <h3 className="text-h4 font-medium text-text-secondary">
              Semantic
            </h3>
            <div className="flex flex-wrap gap-3">
              <ColorSwatch name="Positive" value="#10B981" />
              <ColorSwatch
                name="Positive Muted"
                value="rgba(16, 185, 129, 0.16)"
              />
              <ColorSwatch name="Warning" value="#F59E0B" />
              <ColorSwatch
                name="Warning Muted"
                value="rgba(245, 158, 11, 0.16)"
              />
              <ColorSwatch name="Negative" value="#EF4444" />
              <ColorSwatch
                name="Negative Muted"
                value="rgba(239, 68, 68, 0.16)"
              />
              <ColorSwatch name="Info" value="#3B82F6" />
              <ColorSwatch
                name="Info Muted"
                value="rgba(59, 130, 246, 0.16)"
              />
            </div>
          </div>

          {/* Neutral Colors */}
          <div className="space-y-3">
            <h3 className="text-h4 font-medium text-text-secondary">
              Neutral
            </h3>
            <div className="flex flex-wrap gap-3">
              <ColorSwatch name="50" value="#F9FAFB" />
              <ColorSwatch name="100" value="#F3F4F6" />
              <ColorSwatch name="200" value="#E5E7EB" />
              <ColorSwatch name="300" value="#D1D5DB" />
              <ColorSwatch name="400" value="#9CA3AF" />
              <ColorSwatch name="500" value="#6B7280" />
              <ColorSwatch name="600" value="#374151" />
              <ColorSwatch name="700" value="#1F2937" />
              <ColorSwatch name="800" value="#111827" />
              <ColorSwatch name="900" value="#080D12" />
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 2. Typography Scale */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              2. Typography Scale
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Font sizes and weights
            </p>
          </div>

          <div className="space-y-4">
            <TypographySample
              label="H1"
              size="text-h1"
              weight="font-bold"
              sample="The quick brown fox"
            />
            <TypographySample
              label="H2"
              size="text-h2"
              weight="font-semibold"
              sample="The quick brown fox jumps"
            />
            <TypographySample
              label="H3"
              size="text-h3"
              weight="font-semibold"
              sample="The quick brown fox jumps over"
            />
            <TypographySample
              label="H4"
              size="text-h4"
              weight="font-medium"
              sample="The quick brown fox jumps over the lazy"
            />
            <TypographySample
              label="Body LG"
              size="text-body-lg"
              weight="font-normal"
              sample="The quick brown fox jumps over the lazy dog"
            />
            <TypographySample
              label="Body MD"
              size="text-body-md"
              weight="font-normal"
              sample="The quick brown fox jumps over the lazy dog"
            />
            <TypographySample
              label="Body SM"
              size="text-body-sm"
              weight="font-normal"
              sample="The quick brown fox jumps over the lazy dog"
            />
            <TypographySample
              label="Caption"
              size="text-caption"
              weight="font-normal"
              sample="The quick brown fox jumps over the lazy dog"
            />
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 3. Spacing Scale */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              3. Spacing Scale
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              4px base unit scale
            </p>
          </div>

          <div className="space-y-4">
            <SpacingSample name="4px" width="w-1" />
            <SpacingSample name="8px" width="w-2" />
            <SpacingSample name="12px" width="w-3" />
            <SpacingSample name="16px" width="w-4" />
            <SpacingSample name="24px" width="w-5" />
            <SpacingSample name="32px" width="w-6" />
            <SpacingSample name="40px" width="w-7" />
            <SpacingSample name="48px" width="w-8" />
            <SpacingSample name="80px" width="w-10" />
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 4. Shadows */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              4. Shadows
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Elevation and depth levels
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <ShadowCard name="shadow-sm" shadow="shadow-sm" />
            <ShadowCard name="shadow-md" shadow="shadow-md" />
            <ShadowCard name="shadow-lg" shadow="shadow-lg" />
            <ShadowCard name="shadow-xl" shadow="shadow-xl" />
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 5. Border Radius */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              5. Border Radius
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Corner radius variations
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <RadiusSample name="sm" radius="rounded-sm" size="6px" />
            <RadiusSample name="md" radius="rounded-md" size="10px" />
            <RadiusSample name="lg" radius="rounded-lg" size="16px" />
            <RadiusSample name="xl" radius="rounded-xl" size="20px" />
            <RadiusSample name="full" radius="rounded-full" size="9999px" />
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 6. Buttons */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              6. Buttons
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Primary, Secondary, and Text button variants
            </p>
          </div>

          <div className="space-y-8">
            {/* Primary Buttons */}
            <div className="space-y-3">
              <h3 className="text-h4 font-medium text-text-secondary">
                Primary
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-body-md font-medium text-white transition-colors hover:bg-primary-hover active:bg-primary-active"
                >
                  Default
                </button>
                <button
                  type="button"
                  className="rounded-md border border-primary bg-transparent px-4 py-2 text-body-md font-medium text-primary transition-colors hover:bg-primary-muted"
                >
                  Outline
                </button>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-md bg-primary px-4 py-2 text-body-md font-medium text-white opacity-50"
                >
                  Disabled
                </button>
              </div>
            </div>

            {/* Secondary Buttons */}
            <div className="space-y-3">
              <h3 className="text-h4 font-medium text-text-secondary">
                Secondary
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  className="rounded-md bg-secondary px-4 py-2 text-body-md font-medium text-white transition-colors hover:bg-secondary-hover active:bg-secondary-active"
                >
                  Default
                </button>
                <button
                  type="button"
                  className="rounded-md border border-secondary bg-transparent px-4 py-2 text-body-md font-medium text-secondary transition-colors hover:bg-surface-elevated"
                >
                  Outline
                </button>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-md bg-secondary px-4 py-2 text-body-md font-medium text-white opacity-50"
                >
                  Disabled
                </button>
              </div>
            </div>

            {/* Text Buttons */}
            <div className="space-y-3">
              <h3 className="text-h4 font-medium text-text-secondary">
                Text
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-body-md font-medium text-primary transition-colors hover:bg-primary-muted"
                >
                  Default
                </button>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-md px-4 py-2 text-body-md font-medium text-primary opacity-50"
                >
                  Disabled
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 7. Chips/Category Tags */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              7. Chips / Category Tags
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Category and status indicators
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Chip label="AI Tools" variant="primary" />
            <Chip label="AI Code" variant="primary" />
            <Chip label="Backend" variant="default" />
            <Chip label="DevOps" variant="default" />
            <Chip label="Frontend" variant="default" />
            <Chip label="Database" variant="default" />
            <Chip label="Security" variant="warning" />
            <Chip label="Testing" variant="info" />
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 8. Tool Score Display */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              8. Tool Score Display
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Excellent / Average / Poor gradient bar
            </p>
          </div>

          <div className="space-y-6">
            <ToolScoreDisplay
              level="excellent"
              label="Excellent"
              percentage={92}
            />
            <ToolScoreDisplay
              level="average"
              label="Average"
              percentage={65}
            />
            <ToolScoreDisplay
              level="poor"
              label="Poor"
              percentage={28}
            />
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border-default" />

        {/* 9. Icons */}
        <section className="space-y-6">
          <div>
            <h2 className="text-h2 font-semibold text-text-primary">
              9. Icons
            </h2>
            <p className="text-body-md text-text-muted mt-1">
              Line style, 2px stroke, 24x24 grid
            </p>
          </div>

          <div className="grid grid-cols-6 gap-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
            <IconSample name="Search">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </IconSample>
            <IconSample name="Home">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </IconSample>
            <IconSample name="User">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </IconSample>
            <IconSample name="Settings">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </IconSample>
            <IconSample name="Star">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </IconSample>
            <IconSample name="Heart">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </IconSample>
            <IconSample name="Check">
              <polyline points="20,6 9,17 4,12" />
            </IconSample>
            <IconSample name="X">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </IconSample>
            <IconSample name="Arrow Right">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12,5 19,12 12,19" />
            </IconSample>
            <IconSample name="External Link">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15,3 21,3 21,9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </IconSample>
          </div>
        </section>

        {/* Footer */}
        <section className="border-t border-border-default pt-8 pb-16">
          <p className="text-caption text-text-muted">
            DevScout AI Design System v1.0 — Built with Tailwind CSS v4
          </p>
        </section>
      </div>
    </main>
  );
}

// --- Helper Components ---

function ColorSwatch({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border border-border-default"
        style={{ backgroundColor: value }}
      />
      <div className="text-sm">
        <p className="text-text-primary font-medium">{name}</p>
        <p className="text-caption text-text-muted">{value}</p>
      </div>
    </div>
  );
}

function TypographySample({
  label,
  size,
  weight,
  sample,
}: {
  label: string;
  size: string;
  weight: string;
  sample: string;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="w-24 text-caption text-text-muted shrink-0">
        {label}
      </span>
      <span className={`${size} ${weight} text-text-primary truncate`}>
        {sample}
      </span>
    </div>
  );
}

function SpacingSample({
  name,
  width,
}: {
  name: string;
  width: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-16 text-caption text-text-muted shrink-0">
        {name}
      </span>
      <div className={`${width} h-4 bg-primary`} />
    </div>
  );
}

function ShadowCard({
  name,
  shadow,
}: {
  name: string;
  shadow: string;
}) {
  return (
    <div
      className={`${shadow} flex h-24 w-40 items-center justify-center rounded-lg bg-surface-elevated`}
    >
      <span className="text-caption text-text-muted">{name}</span>
    </div>
  );
}

function RadiusSample({
  name,
  radius,
  size,
}: {
  name: string;
  radius: string;
  size: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${radius} flex h-16 w-16 items-center justify-center bg-primary`}
      >
        <span className="text-caption text-text-primary">{size}</span>
      </div>
      <span className="text-caption text-text-muted">{name}</span>
    </div>
  );
}

function Chip({
  label,
  variant,
}: {
  label: string;
  variant: 'default' | 'primary' | 'positive' | 'warning' | 'negative' | 'info';
}) {
  const variantClasses = {
    default: 'bg-n-700 text-text-secondary',
    primary: 'bg-primary-muted text-primary',
    positive: 'bg-positive-muted text-positive',
    warning: 'bg-warning-muted text-warning',
    negative: 'bg-negative-muted text-negative',
    info: 'bg-info-muted text-info',
  };

  return (
    <span
      className={`${variantClasses[variant]} rounded-full px-3 py-1 text-caption font-medium`}
    >
      {label}
    </span>
  );
}

function ToolScoreDisplay({
  level,
  label,
  percentage,
}: {
  level: 'excellent' | 'average' | 'poor';
  label: string;
  percentage: number;
}) {
  const gradientColors = {
    excellent: 'from-positive to-info',
    average: 'from-warning to-primary',
    poor: 'from-negative to-warning',
  };

  const textColors = {
    excellent: 'text-positive',
    average: 'text-warning',
    poor: 'text-negative',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-text-secondary">{label}</span>
        <span className={`text-body-sm font-medium ${textColors[level]}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-n-700">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientColors[level]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function IconSample({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-elevated">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-secondary"
        >
          {children}
        </svg>
      </div>
      <span className="text-caption text-text-muted text-center">{name}</span>
    </div>
  );
}
