# Implementation Prompt: Clerk Authentication for DevScout AI

## Goal
Implement Clerk authentication for DevScout AI (Next.js 16, shadcn/ui base-nova style) with public-first middleware strategy, shadcn theme integration, and custom sign-in/sign-up pages matching the app's design system.

## Assigned Specialist Agent(s)
- **Frontend Engineer** (primary)
- **Security Engineer** (review middleware and secret handling)

## Skills Read
- `clerk-setup` — framework setup, ClerkProvider placement, shadcn theme
- `clerk-nextjs-patterns` — Next.js patterns, middleware strategies (public-first), proxy.ts
- `clerk-custom-ui` — shadcn theme, appearance prop, custom sign-in/up pages

## Existing Code Inspected
| File | Key Findings |
|------|--------------|
| `package.json` | Next.js 16.2.10, React 19, shadcn/ui base-nova style, cssVariables: true, **no Clerk packages installed** |
| `app/layout.tsx` | Root layout with Header/Footer, no ClerkProvider, body class uses design system tokens |
| `components/header.tsx` | Lines 96-98: "Login" button needs replacement with Clerk components |
| `components.json` | shadcn/ui config: style="base-nova", cssVariables=true, baseColor="neutral" |
| `app/globals.css` | Design system tokens, Tailwind v4, @import "shadcn/tailwind.css", dark theme tokens |
| `.env.local` | Already has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` |

## Decisions / Assumptions
1. **Middleware Strategy**: Public-first (marketing site) — protect `/dashboard(.*)`, `/settings(.*)`, `/tools/(.*)`, `/api/private(.*)` only. Home page `/` stays public.
2. **Middleware File**: `proxy.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)
3. **Auth Routes**: Catch-all routes at `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx`
4. **Theme**: shadcn theme from `@clerk/ui/themes` — **required** since `components.json` exists
5. **Header**: Replace "Login" button (line 96-98) with `<SignInButton />`, `<SignUpButton />`, and `<UserButton />` from `@clerk/nextjs`
6. **Environment**: `.env.local` already has keys — do NOT modify env files
7. **Security**: Never expose `CLERK_SECRET_KEY` to client; middleware must include API route matcher

## Files Likely to Change
| File | Action |
|------|--------|
| `package.json` | Add `@clerk/nextjs` and `@clerk/ui` |
| `proxy.ts` (new) | Public-first middleware with route matchers |
| `app/layout.tsx` | Wrap children with `<ClerkProvider appearance={{ theme: shadcn }}>` inside `<body>` |
| `app/globals.css` | Add `@import '@clerk/ui/themes/shadcn.css';` |
| `app/sign-in/[[...sign-in]]/page.tsx` (new) | `<SignIn appearance={{ theme: shadcn }} />` |
| `app/sign-up/[[...sign-up]]/page.tsx` (new) | `<SignUp appearance={{ theme: shadcn }} />` |
| `components/header.tsx` | Replace Login button with Clerk components |

## Implementation Requirements

### 1. Install Dependencies
```bash
npm install @clerk/nextjs @clerk/ui
```

### 2. Create `proxy.ts` (Public-First Middleware)
**Location**: `proxy.ts` (project root, same level as `app/`)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/tools/(.*)',
  '/api/private(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

**Security Requirements**:
- Matcher MUST include `/(api|trpc)(.*)` to protect API routes
- Home page `/` is intentionally NOT in protected routes (public-first)
- Sign-in and sign-up routes are automatically public (not in protected list)
- Tool details pages at `/tools/[id]` are protected (require authentication)

### 3. Update `app/layout.tsx`
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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
  icons: {
    icon: "/logo.png",
  },
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
      <body className="min-h-full flex flex-col bg-background text-text-primary font-primary overflow-x-hidden">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <Header />
          <main className="flex-1 overflow-x-hidden">{children}</main>
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**Critical**: `ClerkProvider` MUST wrap children INSIDE `<body>`, not `<html>`.

### 4. Update `app/globals.css`
Add after existing imports (line 3):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import '@clerk/ui/themes/shadcn.css';
```

### 5. Create `app/sign-in/[[...sign-in]]/page.tsx`
```tsx
import { SignIn } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignIn
        appearance={{ theme: shadcn }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
```

### 6. Create `app/sign-up/[[...sign-up]]/page.tsx`
```tsx
import { SignUp } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp
        appearance={{ theme: shadcn }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
      />
    </div>
  );
}
```

### 7. Update `components/header.tsx`
**Replace lines 96-98** (the "Login" button) with Clerk components:

```tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

// ... existing TopBar component ...

export function Header() {
  return (
    <div className="sticky top-0 z-50">
      <TopBar />
      <header className="border-b border-[#1f2937] bg-[#080d14]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu - visible on mobile only */}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#1f2937] hover:text-white transition-colors md:hidden"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="DevScout AI logo"
                width={40}
                height={40}
                className="rounded-lg"
                priority
              />
              <div className="flex flex-col">
                <span className="text-[16px] font-bold text-white leading-tight">DevScout <span className="text-[#7c3aed]">AI</span></span>
                <span className="text-[11px] text-[#9ca3af] leading-tight hidden sm:block">Developer Tools Discovery Platform</span>
              </div>
            </Link>
          </div>

          {/* Navigation - hidden on mobile */}
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" className="text-[14px] font-medium text-white">Home</Link>
            <Link href="/categories" className="text-[14px] font-medium text-[#9ca3af] hover:text-white">Categories</Link>
            <Link href="/collections" className="text-[14px] font-medium text-[#9ca3af] hover:text-white">Collections</Link>
            <Link href="/resources" className="text-[14px] font-medium text-[#9ca3af] hover:text-white">Resources</Link>
            <Link href="/for-you" className="flex items-center gap-1 text-[14px] font-medium text-[#9ca3af] hover:text-white">
              For You
              <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">New</span>
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] font-medium text-white hover:opacity-90 transition-opacity whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="hidden sm:block">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Subscribe
            </button>
            
            {/* Clerk Auth Buttons - Replace the old Login button */}
            <SignInButton
              mode="modal"
              appearance={{ theme: shadcn }}
            >
              <button className="hidden sm:block rounded-lg border border-[#374151] bg-transparent px-4 py-2 text-[14px] text-[#9ca3af] hover:border-[#6b7280] hover:text-white transition-colors">
                Sign In
              </button>
            </SignInButton>
            
            <SignUpButton
              mode="modal"
              appearance={{ theme: shadcn }}
            >
              <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] font-medium text-white hover:opacity-90 transition-opacity whitespace-nowrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="hidden sm:block">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Get Started
              </button>
            </SignUpButton>
            
            <UserButton
              appearance={{ theme: shadcn }}
              afterSignOutUrl="/"
            />
          </div>
        </div>
      </header>
    </div>
  );
}
```

**Key Changes**:
- Add `'use client'` directive at top
- Import `SignInButton`, `SignUpButton`, `UserButton` from `@clerk/nextjs`
- Import `shadcn` from `@clerk/ui/themes`
- Replace the plain "Login" button (lines 96-98) with:
  - `<SignInButton mode="modal">` wrapping a styled button
  - `<SignUpButton mode="modal">` wrapping the "Get Started" button (reusing existing gradient style)
  - `<UserButton />` for signed-in users (shows avatar, menu, sign out)
- All Clerk components use `appearance={{ theme: shadcn }}`

### 8. Visual/Design Requirements
- **Theme Consistency**: Clerk components MUST use `shadcn` theme to match base-nova design system
- **Colors**: Use existing design tokens (`--color-primary: #6366F1`, `--color-background: #080D12`, etc.)
- **Modal Mode**: SignIn/SignUp buttons use `mode="modal"` for seamless UX without page navigation
- **Button Styling**: Custom button children preserve existing header design (gradient for Sign Up, border for Sign In)
- **UserButton**: Shows user avatar, name, email, and sign out — styled with shadcn theme
- **Responsive**: Mobile shows hamburger menu; auth buttons hidden on mobile (matching original Login button behavior)

## Security Requirements
- [ ] `CLERK_SECRET_KEY` never exposed to client (only in server code via `@clerk/nextjs/server`)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` used for client-side only
- [ ] Middleware `matcher` includes `/(api|trpc)(.*)` for API route protection
- [ ] No hardcoded secrets in code
- [ ] `proxy.ts` uses `createRouteMatcher` for type-safe route matching

## Acceptance Criteria
- [ ] `npm install @clerk/nextjs @clerk/ui` succeeds
- [ ] `proxy.ts` created with public-first strategy protecting `/dashboard`, `/settings`, `/api/private`
- [ ] `app/layout.tsx` wraps children with `<ClerkProvider appearance={{ theme: shadcn }}>` inside `<body>`
- [ ] `app/globals.css` imports `@clerk/ui/themes/shadcn.css`
- [ ] `app/sign-in/[[...sign-in]]/page.tsx` renders `<SignIn appearance={{ theme: shadcn }} />`
- [ ] `app/sign-up/[[...sign-up]]/page.tsx` renders `<SignUp appearance={{ theme: shadcn }} />`
- [ ] `components/header.tsx` uses `SignInButton`, `SignUpButton`, `UserButton` with shadcn theme
- [ ] Header shows "Sign In" / "Get Started" when signed out
- [ ] Header shows `UserButton` (avatar menu) when signed in
- [ ] Modal sign-in/up opens on button click, styled with shadcn theme
- [ ] Protected routes redirect to sign-in when unauthenticated
- [ ] Public routes (`/`, `/categories`, etc.) accessible without auth
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)

## Checks to Run
```bash
npm run typecheck
npm run lint
npm run build
```

## Exact Manual Test Steps
1. **Start dev server**: `npm run dev` (watch terminal for Clerk logs)
2. **Home page**: Navigate to `http://localhost:3000`
   - Verify header shows "Sign In" (border button) and "Get Started" (gradient button)
   - Verify no Clerk errors in console
3. **Sign In modal**: Click "Sign In"
   - Verify modal opens with shadcn-styled Clerk component
   - Verify "Sign up" link in modal navigates to sign-up modal
4. **Sign Up modal**: Click "Get Started"
   - Verify modal opens with shadcn-styled Clerk component
   - Complete sign up (use test email)
   - Verify redirect to home page after success
5. **Signed-in state**: On home page after sign up
   - Verify header shows `UserButton` (avatar with dropdown)
   - Click avatar → verify menu shows user info and "Sign out"
6. **Sign out**: Click "Sign out" in user menu
   - Verify redirect to home page
   - Verify header shows "Sign In" / "Get Started" again
7. **Protected route test**: Navigate to `http://localhost:3000/dashboard`
   - Verify redirect to `/sign-in` with `redirect_url` parameter
   - Sign in → verify redirect back to `/dashboard`
8. **Direct sign-in page**: Navigate to `http://localhost:3000/sign-in`
   - Verify full-page sign-in renders with shadcn theme
9. **Direct sign-up page**: Navigate to `http://localhost:3000/sign-up`
   - Verify full-page sign-up renders with shadcn theme

## Handoff Notes
- After implementation, **Frontend Engineer** shares exact test steps above
- **Code Reviewer** reviews diff for security (no secret exposure, middleware matcher correctness)
- **QA Engineer** runs `typecheck`, `lint`, `build` and reports exact output
- **Documentation Memory Agent** logs outcome to `docs/agents/memory-log.md`
- **CEO Assistant** compiles final report

---
*Prompt created by Prompt Engineer for Frontend Engineer implementation*