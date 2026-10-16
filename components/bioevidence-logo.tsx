import Image from "next/image";

type BioEvidenceLogoProps = {
  className?: string;
  title?: string;
  variant?: "glyph" | "search" | "wordmark";
};

const logoAssets = {
  glyph: {
    light: {
      height: 806,
      src: "/bioevidence/bioevidence-glyph-paper.png",
      width: 639,
    },
    focus: {
      height: 893,
      src: "/bioevidence/bioevidence-glyph-focus.png",
      width: 681,
    },
  },
  search: {
    light: {
      height: 806,
      src: "/bioevidence/bioevidence-glyph-paper.png",
      width: 639,
    },
    focus: {
      height: 806,
      src: "/bioevidence/bioevidence-glyph-paper.png",
      width: 639,
    },
  },
} as const;

export function BioEvidenceLogo({
  className = "",
  title = "BioEvidence AI",
  variant = "glyph",
}: BioEvidenceLogoProps) {
  const assets = logoAssets[variant === "wordmark" ? "glyph" : variant];
  const classes = [
    variant === "wordmark" ? "bio-wordmark" : null,
    "bio-logo-image",
    `bio-logo-image-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const sizes =
    variant === "wordmark" ? "144px" : variant === "search" ? "28px" : "44px";
  const mark = (
    <span
      className={
        variant === "wordmark" ? "bio-wordmark-glyph" : "bio-glyph-frame"
      }
      aria-hidden="true"
    >
      <Image
        className="bio-logo-asset bio-logo-asset-light"
        src={assets.light.src}
        alt=""
        width={assets.light.width}
        height={assets.light.height}
        sizes={sizes}
        aria-hidden="true"
      />
      <Image
        className="bio-logo-asset bio-logo-asset-focus"
        src={assets.focus.src}
        alt=""
        width={assets.focus.width}
        height={assets.focus.height}
        sizes={sizes}
        aria-hidden="true"
      />
    </span>
  );

  return (
    <span
      className={classes}
      role="img"
      aria-label={title}
    >
      {mark}
      {variant === "wordmark" ? (
        <span className="bio-wordmark-copy" aria-hidden="true">
          <strong>BioEvidence</strong>
          <em>AI</em>
        </span>
      ) : null}
    </span>
  );
}
