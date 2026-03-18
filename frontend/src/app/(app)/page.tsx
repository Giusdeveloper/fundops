import LandingPage from "@/components/landing/LandingPage";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function Home({ searchParams }: { searchParams?: SearchParams }) {
  const code = getFirstParam(searchParams?.code);
  const error = getFirstParam(searchParams?.error);
  const errorCode = getFirstParam(searchParams?.error_code);
  const errorDescription = getFirstParam(searchParams?.error_description);

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
