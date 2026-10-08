import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/admin/theme-provider";
import { Toaster } from "@/components/admin/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Super Admin Dashboard",
    template: "%s | Super Admin Dashboard",
  },
  description:
    "Console d'administration de la plateforme SaaS multi-tenant e-commerce.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="fr" suppressHydrationWarning>
        <body>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
