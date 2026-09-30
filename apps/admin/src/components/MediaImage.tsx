"use client";

import { useEffect, useState } from "react";
import { resolveMediaUrls } from "@/services/media.service";
import { isMediaRef } from "@repo/types";

/**
 * Resolves mixed media references to URLs, memoized per render batch.
 * Legacy values (raw URLs, `/products/1.png`) pass through untouched;
 * `media:<uuid>` values resolve via media-service (null while processing).
 */
export function useMediaUrls(refs: string[]): Record<string, string | null> {
  const [resolved, setResolved] = useState<Record<string, string | null>>({});
  const key = refs.filter(Boolean).sort().join("|");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const refsToResolve = key.split("|");
    resolveMediaUrls(refsToResolve).then((items) => {
      if (!cancelled) setResolved(items);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return resolved;
}

/** Picks a URL for a reference from a resolution map, with passthrough. */
export function pickMediaUrl(
  ref: string | undefined,
  resolved: Record<string, string | null>,
): string | null {
  if (!ref) return null;
  // Legacy URLs and local paths are valid as-is.
  if (!isMediaRef(ref)) return ref;
  return resolved[ref] ?? null;
}

export interface MediaImageProps {
  ref_?: string | undefined;
  src?: string | undefined;
  alt: string;
  className?: string;
  size?: number;
}

/**
 * Image component that renders either a legacy URL or a resolved
 * media reference, with a neutral placeholder while unresolved.
 */
export default function MediaImage({
  ref_,
  src,
  alt,
  className,
  size,
}: MediaImageProps) {
  const targetRef = ref_ ?? src;
  const resolved = useMediaUrls(targetRef ? [targetRef] : []);
  const url = pickMediaUrl(targetRef, resolved);

  const style = size ? { width: size, height: size } : undefined;

  if (!url) {
    return (
      <div
        className={
          className ??
          "rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground"
        }
        style={style}
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className ?? "rounded-full object-cover"}
      style={style}
    />
  );
}
