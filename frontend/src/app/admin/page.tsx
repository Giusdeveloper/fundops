import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/adminAuth";
import AdminUsersTable from "./AdminUsersTable";

export default async function AdminPage() {
  const admin = await getAdminProfile();
  if (!admin) {
    redirect("/dashboard");
  }

  return (
    <div className="dashboard-content">
      <AdminUsersTable />
    </div>
  );
}
