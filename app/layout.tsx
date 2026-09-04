import type { Metadata, Viewport } from "next";
import { AppSplash } from "@/components/app-splash";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lista de Casa",
    template: "%s | Lista de Casa",
  },
  description: "Lista de compras compartilhada para toda a família.",
  applicationName: "Lista de Casa",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Lista de Casa",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#087f6a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
