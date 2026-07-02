import Image from "next/image";
import { Section } from "./Section";
import { SectionLabel } from "./SectionLabel";
import { LinkButton } from "./LinkButton";
import { copy, STUDIO_HREF } from "./copy";

/**
 * Above-the-fold hero: serif headline + single filled CTA on the left, the
 * lifestyle scene (a real engine-rendered poster composited into the frame,
 * see scripts/compose-scenes.ts) on the right.
 */
export function Hero() {
  const { hero } = copy;
  return (
    <Section className="pt-28 md:pt-36">
      <div id="top" className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
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
          <p className="text-[14px] leading-[1.5] text-muted">{hero.reassurance}</p>
        </div>

        <div
          className="overflow-hidden rounded-xl shadow-[0_24px_48px_-12px_rgba(31,27,22,0.25)]"
          style={{ aspectRatio: hero.media.aspect }}
        >
          <Image
            src={hero.media.src}
            alt={hero.media.alt}
            width={1264}
            height={848}
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </Section>
  );
}
