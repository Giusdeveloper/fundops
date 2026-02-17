import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function InvestorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Area Investitore</h1>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Email
        </p>
        <p className="font-medium mb-4">{user.email ?? "—"}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          User ID
        </p>
        <p className="font-mono text-sm break-all">{user.id}</p>
      </div>
    </div>
  );
}
