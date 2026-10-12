"use client";

import { useLenis } from "@/hooks/use-lenis";
import { ReactNode } from "react";

export default function ClientWrapper({ children }: { children: ReactNode }) {
  // Initialize Lenis smooth scroll
  useLenis();

  return <>{children}</>;
}
