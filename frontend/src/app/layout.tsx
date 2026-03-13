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
  title: "FundOps – Il fundraising sotto controllo",
  description:
    "Piattaforma FundOps per gestire supporter, LOI, documenti e dashboard di fundraising in un unico flusso.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const uiContext = await getUserUiContext();

  return (
    <html lang="it" suppressHydrationWarning>
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
