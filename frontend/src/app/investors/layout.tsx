import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function InvestorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
