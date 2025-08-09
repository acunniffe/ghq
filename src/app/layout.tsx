import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { BoardArrowProvider } from "@/game/BoardArrowProvider";
import { MatchmakingProvider } from "@/components/MatchmakingProvider";
import MatchmakingToast from "@/components/MatchmakingToast";
import { config } from "@/lib/config";
import { LatestMoveProvider } from "@/components/LatestMoveContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GHQ",
  description: "Play GHQ online, learn to play, and join the community.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  openGraph: {
    title: "GHQ",
    siteName: "GHQ",
    description: "Play GHQ online, learn to play, and join the community.",
    images: ["/ogimage.png"],
    type: "website",
    locale: "en_US",
    url: "https://www.playghq.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Development version without auth or matchmaking
  if (!config.useClerk) {
    return (
      <BoardArrowProvider>
        <LatestMoveProvider>
          <html lang="en">
            <body
              className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
              {children}
              <Toaster />
            </body>
          </html>
        </LatestMoveProvider>
      </BoardArrowProvider>
    );
  }

  return (
    <ClerkProvider
      dynamic
      signUpFallbackRedirectUrl={"/"}
      signInFallbackRedirectUrl={"/"}
    >
      <MatchmakingProvider>
        <BoardArrowProvider>
          <LatestMoveProvider>
            <html lang="en">
              <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
              >
                {children}
                <Toaster />
                <MatchmakingToast />
              </body>
            </html>
          </LatestMoveProvider>
        </BoardArrowProvider>
      </MatchmakingProvider>
    </ClerkProvider>
  );
}
