import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function IssuanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
