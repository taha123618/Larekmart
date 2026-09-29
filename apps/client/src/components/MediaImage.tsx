"use client";

import { useEffect, useState } from "react";
import { resolveMediaUrls } from "@/services/media.service";

/** Picks a URL for a reference: legacy values pass through, media ids resolve. */
function pickUrl(
  ref: string | undefined,
  resolved: Record<string, string | null>,
): string | null {
  if (!ref) return null;
  if (!ref.startsWith("media:") && !/^[0-9a-f-]{36}$/i.test(ref)) return ref;
  return resolved[ref] ?? null;
}

interface MediaImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
}

/**
 * Product image that renders legacy URLs directly and resolves media
 * references (`media:<uuid>`) through media-service. Renders nothing until
 * a media reference resolves (variants are processed asynchronously).
 */
export default function MediaImage({ src, alt, className }: MediaImageProps) {
  const needsResolve =
    !!src && (src.startsWith("media:") || /^[0-9a-f-]{36}$/i.test(src));
  const [resolved, setResolved] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!needsResolve || !src) return;
    let cancelled = false;
    resolveMediaUrls([src]).then((items) => {
      if (!cancelled) setResolved(items);
    });
    return () => {
      cancelled = true;
    };
  }, [needsResolve, src]);

  const url = pickUrl(src, resolved);
  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={className} />
  );
}
