import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import WishlistDrawer from "@/components/WishlistDrawer";
import QuickViewModal from "@/components/QuickViewModal";
import { ToastContainer } from "react-toastify";
import { ClerkProvider } from "@clerk/nextjs";
import CartStoreHydration from "@/components/providers/CartStoreHydration";
import QueryProvider from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import ClientWrapper from "@/wrapper/client-wrapper";
import ScrollToTop from "@/components/common/ScrollToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Larekmart — Modern Global Marketplace",
  description:
    "Shop millions of trending products with buyer protection, fast delivery, and secure payments.",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  // `suppressHydrationWarning` is set on <body> to guard against browser extensions
  return (
    <ClerkProvider>
      <html
        lang="en"
        className="scroll-smooth"
        data-scroll-behavior="smooth"
        suppressHydrationWarning
      >
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased min-h-screen flex flex-col transition-colors duration-200 relative selection:bg-indigo-500/20 selection:text-indigo-400`}
          suppressHydrationWarning
        >
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ClientWrapper>
                <CartStoreHydration />
                <CartDrawer />
                <WishlistDrawer />
                <QuickViewModal />

                {/* FULL-WIDTH MARKETPLACE NAVIGATION */}
                <Navbar />

                {/* MAIN CONTENT CONTAINER */}
                <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  {children}
                </main>

                {/* FULL-WIDTH FOOTER */}
                <Footer />

                {/* SCROLL TO TOP FLOATING BUTTON & PROGRESS */}
                <ScrollToTop />

                <ToastContainer position="bottom-right" theme="dark" />
              </ClientWrapper>
            </ThemeProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
