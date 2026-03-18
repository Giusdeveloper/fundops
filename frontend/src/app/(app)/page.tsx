import LandingPage from "@/components/landing/LandingPage";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const code = getFirstParam(resolvedSearchParams?.code);
  const error = getFirstParam(resolvedSearchParams?.error);
  const errorCode = getFirstParam(resolvedSearchParams?.error_code);
  const errorDescription = getFirstParam(resolvedSearchParams?.error_description);

  if (code || error || errorCode || errorDescription) {
    const query = new URLSearchParams();
    if (code) query.set("code", code);
    if (error) query.set("error", error);
    if (errorCode) query.set("error_code", errorCode);
    if (errorDescription) query.set("error_description", errorDescription);
    redirect(`/auth/callback?${query.toString()}`);
  }

  return <LandingPage />;
}
