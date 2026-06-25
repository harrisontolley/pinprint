"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";

// PostHog feature-flag pattern. No flag is consumed yet — this establishes how to
// read one. Returns false until flags load and when PostHog is unconfigured, so
// callers can treat the feature as off by default. See docs/integrations/posthog.md.
export function useFlag(key: string): boolean {
  return useFeatureFlagEnabled(key) ?? false;
}
