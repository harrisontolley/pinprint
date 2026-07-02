import Image from "next/image";
import { Section } from "./Section";
import { LinkButton } from "./LinkButton";
import { copy, STUDIO_HREF } from "./copy";

/**
 * Closing CTA band: the gift scene (a real print composited into the frame)
 * beside the final repeat of the primary action. Shared by /, /faq and the
 * compare pages.
 */
export function FinalCTA() {
  const { finalCta } = copy;
  return (
    <Section tone="soft">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div
          className="overflow-hidden rounded-xl shadow-[0_24px_48px_-12px_rgba(31,27,22,0.25)]"
          style={{ aspectRatio: finalCta.media.aspect }}
        >
          <Image
            src={finalCta.media.src}
            alt={finalCta.media.alt}
            width={1264}
            height={848}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col items-start gap-6">
          <h2 className="font-display text-[clamp(1.75rem,4.5vw,44px)] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
            {finalCta.headline}
          </h2>
          <p className="max-w-[44ch] text-[16px] leading-[1.55] tracking-[0.16px] text-body">
            {finalCta.subhead}
          </p>
          <LinkButton href={STUDIO_HREF} variant="primary" size="md">
            {finalCta.cta}
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}
