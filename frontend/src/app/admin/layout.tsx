import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
