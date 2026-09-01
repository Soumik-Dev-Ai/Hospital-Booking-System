import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";
import { isoFromUTC } from "@/lib/utils";
/**
 * Direct entry – the Admin Command Center mounts immediately into
 * Tab 1 (Patient Tracking & Compliance). No loading screen.
 * The anchor date is computed once on the server and passed down,
 * guaranteeing SSR/hydration consistency for all mock data.
 */
export default function AdminPage() {
  const todayISO = isoFromUTC(new Date());

  return <AdminCommandCenter todayISO={todayISO} />;
}
