'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

function TopBar() {
  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="hidden sm:flex h-8 items-center justify-between border-b border-[#1f2937] bg-[#0a0f16] px-4 md:px-6 lg:px-8">
      <span className="text-xs text-[#6b7280]">{dateString}</span>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#9ca3af]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Set Location
        </button>
        <button className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#9ca3af]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          International Edition
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}

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
            <SignInButton mode="modal" appearance={{ theme: shadcn }}>
              <button className="hidden sm:block rounded-lg border border-[#374151] bg-transparent px-4 py-2 text-[14px] text-[#9ca3af] hover:border-[#6b7280] hover:text-white transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal" appearance={{ theme: shadcn }}>
              <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] font-medium text-white hover:opacity-90 transition-opacity whitespace-nowrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="hidden sm:block">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Get Started
              </button>
            </SignUpButton>
            <UserButton appearance={{ theme: shadcn }} />
          </div>
        </div>
      </header>
    </div>
  )
}
