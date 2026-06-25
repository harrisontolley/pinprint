"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";

// Wires the Neon Auth UI components (AuthView, UserButton, SignedIn/SignedOut) to
// our Next.js router and the auth client. Google is enabled both here and in the
// Neon Console. The UI inherits our design tokens via @neondatabase/auth/ui/tailwind
// (imported once in globals.css), so it matches the editorial pill aesthetic.
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
      social={{ providers: ["google"] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
