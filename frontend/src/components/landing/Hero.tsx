import Image from "next/image";
import { SectionLabel } from "./SectionLabel";
import { LinkButton } from "./LinkButton";
import { copy, STUDIO_HREF } from "./copy";

/**
 * Above-the-fold hero: a full-bleed panoramic room scene (real engine-rendered
 * poster composited into the oak frame at native resolution, see
 * scripts/compose-scenes.ts) with the copy overlaid on the empty wall. On
 * small screens the scene sits above the copy instead of behind it.
 */
function HeroCopy() {
  const { hero } = copy;
  return (
    <div className="flex flex-col items-start gap-6">
      <SectionLabel>{hero.eyebrow}</SectionLabel>
      <h1 className="font-display text-[clamp(2.375rem,5.5vw,64px)] font-normal leading-[1.04] tracking-[-0.02em] text-ink">
        {hero.headline}
      </h1>
      <p className="max-w-[52ch] text-[16px] leading-[1.55] tracking-[0.16px] text-body">
        {hero.subhead}
      </p>
      <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:gap-6">
        <LinkButton href={STUDIO_HREF} variant="primary" size="md">
          {hero.primaryCta}
        </LinkButton>
        <a
          href="#how-it-works"
          className="text-[15px] font-medium text-ink underline-offset-4 hover:underline"
        >
          {hero.secondaryCta}
        </a>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.96px] text-muted">
          {hero.specLine}
        </p>
        <p className="text-[14px] leading-[1.5] text-muted">{hero.reassurance}</p>
      </div>
    </div>
  );
}

export function Hero() {
  const { hero } = copy;
  return (
    <div id="top" className="relative">
      <div className="relative aspect-[16/10] w-full md:aspect-auto md:h-[78vh] md:max-h-[820px] md:min-h-[560px]">
        <Image
          src={hero.media.src}
          alt={hero.media.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Soft ivory wash keeps overlaid copy readable at every crop. */}
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(250,248,243,0.88)_0%,rgba(250,248,243,0.55)_38%,rgba(250,248,243,0)_60%)] md:block"
        />
        <div className="absolute inset-0 hidden items-center md:flex">
          <div className="mx-auto w-full max-w-[1200px] px-6">
            <div className="max-w-[520px]">
              <HeroCopy />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-14 md:hidden">
        <HeroCopy />
      </div>
    </div>
  );
}
