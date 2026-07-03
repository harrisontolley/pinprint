import { SiteHeader } from "./SiteHeader";
import { Hero } from "./Hero";
import { TrustLine } from "./TrustLine";
import { HowItWorks } from "./HowItWorks";
import { GlobeDemo } from "./GlobeDemo";
import { CraftSection } from "./CraftSection";
import { StyleGallery } from "./StyleGallery";
import { Stories } from "./Stories";
import { GiftSection } from "./GiftSection";
import { PricingPreview } from "./PricingPreview";
import { FAQ } from "./FAQ";
import { FinalCTA } from "./FinalCTA";
import { SiteFooter } from "./SiteFooter";

/**
 * Marketing landing page for Pinprint. Server-rendered; the interactive pieces
 * (the globe demo and FAQ's native <details>) are client islands. Every CTA
 * links to the studio. All copy lives in copy.ts; all imagery is real engine
 * renders or composited lifestyle scenes (scripts/compose-scenes.ts).
 *
 * Order: emotional hook (Hero) → quality facts (TrustLine) → mechanics
 * (HowItWorks) → authority (GlobeDemo: the accuracy story with the live globe)
 * → materials (Craft) → range (StyleGallery) → outcomes (Stories) → price →
 * objections (FAQ) → close (FinalCTA).
 */
export function LandingPage() {
  return (
    <main className="bg-canvas text-body">
      <SiteHeader />
      <Hero />
      <TrustLine />
      <HowItWorks />
      <GlobeDemo />
      <CraftSection />
      <StyleGallery />
      <Stories />
      <GiftSection />
      <PricingPreview />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}
