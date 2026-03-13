import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
