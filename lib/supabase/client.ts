// lib/supabase/client.ts
// Supabase client helpers for server-side (service role) and browser-side (anon key)
// Following @supabase/ssr patterns for Next.js 15+

import { createServerClient as createSupabaseServerClient, createBrowserClient as createSupabaseBrowserClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// SupabaseClient in @supabase/supabase-js v2.110 has 5 generic parameters.
// The 4th (Schema) has a conditional constraint that TypeScript cannot fully
// resolve at instantiation time with our manually-defined Database type.
// We work around this by casting through as unknown and providing the correct
// type via the callback methods in each query function with overrideTypes<T>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypedSupabaseClient = SupabaseClient<any>;

// Server-side client with service role key for writes (scraping, analysis, scheduling)
// NEVER expose this to the browser
export async function createServerClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  ) as unknown as TypedSupabaseClient;
}

// Browser-side client with anon key for reads only (UI display)
// This is safe to expose to the browser
export function createBrowserClient(): TypedSupabaseClient {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as TypedSupabaseClient;
}

// Convenience function for server components that need read-only access
// Uses anon key but runs on server
export async function createServerReadOnlyClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignore in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  ) as unknown as TypedSupabaseClient;
}
