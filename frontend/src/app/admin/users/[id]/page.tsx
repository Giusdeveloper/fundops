import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/adminAuth";
import AdminUserDetail from "./AdminUserDetail";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminProfile();
  if (!admin) {
    redirect("/dashboard");
  }

  const { id } = await params;

  return (
    <div className="dashboard-content">
      <AdminUserDetail userId={id} />
    </div>
  );
}
