import IssuanceDetailClient from "./IssuanceDetailClient";

export default async function IssuanceDetailPage({
  params,
}: {
  params: Promise<{ investmentId: string }>;
}) {
  const { investmentId } = await params;
  return <IssuanceDetailClient investmentId={investmentId} />;
}
