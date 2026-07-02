import Image from "next/image";

/**
 * A produced poster render (public/showcase/*.png, 1000x1500 at 2x). The
 * wrapper enforces the 2:3 aspect so the full poster shows uncropped.
 */
type Media = {
  label: string;
  aspect?: string;
  src: string;
  alt?: string;
};

export function PosterImage({
  media,
  className = "",
  priority = false,
  sizes = "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw",
}: {
  media: Media;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl ${className}`}
      style={{ aspectRatio: media.aspect ?? "2 / 3" }}
    >
      <Image
        src={media.src}
        alt={media.alt ?? media.label}
        width={1000}
        height={1500}
        className="h-full w-full object-cover"
        sizes={sizes}
        priority={priority}
      />
    </div>
  );
}
