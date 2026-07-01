import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import Config from "@/lib/config";
import { Toaster } from "@/components/ui/sonner";
import { ScreenPopupProvider } from "@/components/screen-popup";

const notoSans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: Config.APP_NAME,
  description: Config.APP_DESCRIPTION,
};

export default function BaseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={Config.APP_DEFAULT_LANG}
      className={cn(
        "h-full",
        "antialiased",
        notoSans.variable,
        geistMono.variable
      )}
      suppressHydrationWarning
    >
      <body className="min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ScreenPopupProvider>
            {children}
            <Toaster richColors position="bottom-right" />
          </ScreenPopupProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
