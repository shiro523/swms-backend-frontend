"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function PurokLeaderNotificationsPage() {
  const query = useApi(() => api.notifications(), []);
  return (
    <div>
      <PageHeader eyebrow="Updates" title="Notifications" description="Collection schedules, dues, and violation alerts." />
      <AsyncSection query={query}>
        {(notifications) => <NotificationList items={notifications} />}
      </AsyncSection>
    </div>
  );
}
