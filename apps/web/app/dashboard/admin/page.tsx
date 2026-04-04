import { AdminDashboard } from "@/components/admin/admin-dashboard";
import {
	fetchActivityFeed,
	fetchAdminOverview,
	fetchTenantList,
} from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminPage() {
  await requireAdmin(); // redirects if not admin

  const [overview, tenants, activity] = await Promise.all([
    fetchAdminOverview(),
    fetchTenantList(),
    fetchActivityFeed(50),
  ]);

  return <AdminDashboard overview={overview} tenants={tenants} activity={activity} />;
}
