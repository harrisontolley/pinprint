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
import { MobileCtaBar } from "./MobileCtaBar";

/**
 * Marketing landing page for Pinprint. Server-rendered; the interactive pieces
 * (the globe demo, FAQ's native <details>, and the mobile CTA bar) are client
 * islands. Every CTA links to the studio. All copy lives in copy.ts; all
 * imagery is real engine renders or composited lifestyle scenes
 * (scripts/compose-scenes.ts).
 *
 * Order: emotional hook (Hero) → quality facts (TrustLine) → mechanics
 * (HowItWorks) → range (StyleGallery) → outcomes (Stories) → authority
 * (GlobeDemo: the accuracy story with the live globe) → materials (Craft) →
 * gifting (Gift) → price → objections (FAQ) → close (FinalCTA). The visual
 * proof (gallery, stories) comes before the heavy interactive globe so a
 * first scroll — especially on a phone — sells the object before the demo.
 */
export function LandingPage() {
  return (
    <main className="bg-canvas text-body">
      <SiteHeader />
      <Hero />
      <TrustLine />
      <HowItWorks />
      <StyleGallery />
      <Stories />
      <GlobeDemo />
      <CraftSection />
      <GiftSection />
      <PricingPreview />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
      <MobileCtaBar />
    </main>
  );
}
