import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
