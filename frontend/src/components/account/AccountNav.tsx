"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react/ui";
import { LinkButton } from "@/components/landing/LinkButton";

// Header entry point for auth. Shows "Sign in" when signed out, and an Account
// link + UserButton (account settings, sign out, manage Google) when signed in.
// A small client island so the surrounding header can stay a server component.
export function AccountNav() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <LinkButton href="/auth/sign-in" variant="outline" size="sm">
          Sign in
        </LinkButton>
      </SignedOut>
      <SignedIn>
        <Link
          href="/account"
          className="hidden text-[15px] font-medium text-body transition-colors hover:text-ink sm:inline"
        >
          Account
        </Link>
        <UserButton />
      </SignedIn>
    </div>
  );
}
