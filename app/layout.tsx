import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PostHogUserIdentifier } from "@/components/posthog-user-identifier";
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
          <PostHogUserIdentifier />
          <Header />
          <main className="flex-1 overflow-x-hidden">{children}</main>
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  );
}
