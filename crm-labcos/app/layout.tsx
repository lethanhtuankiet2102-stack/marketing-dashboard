import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Labcos | Marketing Dashboard",
  description: "Theo dõi lead, nội dung và hiệu quả marketing của Labcos.",
  icons: {icon:'/favicon.svg'},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
