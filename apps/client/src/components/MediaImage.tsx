"use client";

import { useEffect, useState } from "react";
import { resolveMediaUrls } from "@/services/media.service";
import { isMediaRef } from "@repo/types";

/** Picks a URL for a reference: legacy values pass through, media ids resolve. */
function pickUrl(
  ref: string | undefined,
  resolved: Record<string, string | null>,
): string | null {
  if (!ref) return null;
  if (!isMediaRef(ref)) return ref;
  return resolved[ref] ?? null;
}

interface MediaImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  width?: number;
  height?: number;
}

/**
 * Product image that renders legacy URLs directly and resolves media
 * references (`media:<uuid>`) through media-service. Renders fallback or
 * placeholder while resolving or when unavailable.
 */
export default function MediaImage({
  src,
  alt,
  className,
  fallbackSrc,
  width,
  height,
}: MediaImageProps) {
  const needsResolve = !!src && isMediaRef(src);
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

  const url = pickUrl(src, resolved) || fallbackSrc;
  if (!url) {
    return (
      <div
        className={`bg-gray-100 dark:bg-neutral-800 animate-pulse flex items-center justify-center text-xs text-gray-400 ${className ?? ""}`}
        style={width && height ? { width, height } : undefined}
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  );
}
