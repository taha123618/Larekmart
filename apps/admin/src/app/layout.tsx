import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { RuntimeConfigProvider } from "@/components/providers/RuntimeConfigProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Larekmart — Admin Management Console",
  description:
    "Production-grade administration and ecosystem governance console for the Larekmart microservices platform.",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `suppressHydrationWarning` on <body> guards against browser extensions that inject
  // attributes into it before React hydrates — Grammarly adds `data-gr-ext-installed`
  // and `data-new-gr-c-s-check-loaded`. React's suppression is per element, so the flag
  // on <html> does not cover <body>. Note this only silences attribute/text warnings on
  // <body> itself, so a genuine mismatch there would also be hidden — comment it out
  // temporarily if you ever need to debug one.
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
        >
          <RuntimeConfigProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              scriptProps={{ async: true }}
            >
              {children}
            </ThemeProvider>
          </RuntimeConfigProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
