import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import { CompanyProvider } from "../context/CompanyContext";
import { ToastProvider } from "../components/ToastProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Smart Equity Dashboard",
  description: "Gestisci investor, LOI e data room",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={poppins.variable}>
        <CompanyProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </CompanyProvider>
      </body>
    </html>
  );
}
