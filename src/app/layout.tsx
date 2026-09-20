import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { LayoutContent } from "@/components/layout/layout-content";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM Labcos",
  description: "CRM Labcos - quản lý khách hàng, pipeline và vận hành marketing",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <ThemeProvider>
          <LayoutContent>{children}</LayoutContent>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
