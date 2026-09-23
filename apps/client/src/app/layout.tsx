import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ToastContainer } from "react-toastify";
import { ClerkProvider } from "@clerk/nextjs";
import CartStoreHydration from "@/components/providers/CartStoreHydration";
import QueryProvider from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Larekmart - Best Clothes",
  description: "Larekmart is the best place to find the best clothes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `suppressHydrationWarning` is set on <body> only. It guards against browser
  // extensions that inject attributes into it before React hydrates — Grammarly adds
  // `data-gr-ext-installed` and `data-new-gr-c-s-check-loaded`. React's suppression is
  // per element, so it does not cover children: a genuine mismatch inside the tree is
  // still reported. It is deliberately NOT set on <html>, which nothing mutates here.
  return (
    <ClerkProvider>
      <QueryProvider>
        <html lang="en">
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            suppressHydrationWarning
          >
            <CartStoreHydration />
            <div className="mx-auto p-4 sm:px-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-6xl">
              <Navbar />
              {children}
              <Footer />
            </div>
            <ToastContainer position="bottom-right" />
          </body>
        </html>
      </QueryProvider>
    </ClerkProvider>
  );
}
