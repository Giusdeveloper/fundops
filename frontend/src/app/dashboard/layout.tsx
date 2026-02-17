import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
