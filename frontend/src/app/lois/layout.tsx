import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function LoisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
