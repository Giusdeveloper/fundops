import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import { CompanyProvider } from "../context/CompanyContext";
import { ToastProvider } from "../components/ToastProvider";
import { getUserUiContext } from "@/lib/auth/getUserUiContext";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Smart Equity Dashboard",
  description: "Gestisci investor, LOI e data room",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const uiContext = await getUserUiContext();

  return (
    <html lang="it">
      <body className={poppins.variable}>
        <CompanyProvider>
          <ToastProvider>
            <AppShell uiContext={uiContext}>{children}</AppShell>
          </ToastProvider>
        </CompanyProvider>
      </body>
    </html>
  );
}
