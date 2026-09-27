import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSS Logistics · Internal Operations",
  description: "PSS Logistics Super Admin Control Center",
  icons: { icon: "/pss-mark.png" },
  robots: { index: false, follow: false },
};

type RootLayoutProps = { children: ReactNode };

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://pss-api.psslogisticsadmin.workers.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//pss-api.psslogisticsadmin.workers.dev" />
        <link rel="preconnect" href="https://qyelfkmafzspctqkrwxf.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//qyelfkmafzspctqkrwxf.supabase.co" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
