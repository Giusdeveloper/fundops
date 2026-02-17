import EnsureProfileWrapper from "@/components/EnsureProfileWrapper";

export default function CompaniesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnsureProfileWrapper>{children}</EnsureProfileWrapper>;
}
