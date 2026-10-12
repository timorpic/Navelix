"use client";

import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import { useAdminUpdateCheck } from "@/hooks/use-admin-update-check";
import { useAdminDbBackup } from "@/hooks/use-admin-db-backup";
import { useAdminCachePurge } from "@/hooks/use-admin-cache-purge";
import AdminSystemUpdateCard from "./admin-system-update-card";
import AdminSystemDbBackupCard from "./admin-system-db-backup-card";
import AdminSystemCachePurgeCard from "./admin-system-cache-purge-card";

function MaintenanceSettings() {
  const { notice, notify } = useToast();
  const update = useAdminUpdateCheck();
  const db = useAdminDbBackup({ notify });
  const purge = useAdminCachePurge({ notify });
  return <div className="space-y-6">
    <Toast message={notice} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <AdminSystemUpdateCard update={update} />
      <div className="space-y-6"><AdminSystemDbBackupCard db={db} /><AdminSystemCachePurgeCard purge={purge} /></div>
    </div>
  </div>;
}
/** Render only the selected domain, so unrelated settings do not trigger requests. */
export default function AdminSystemTab({ currentUser }: {
  currentUser?: { role?: "admin" | "user"; username?: string } | null;
}) {
  if (currentUser?.role !== "admin") return null;
  return <MaintenanceSettings />;
}
