"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { ProfileEditor } from "./ProfileEditor";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function ResidentProfilePage() {
  const query = useApi(() => api.households().then((h) => h[0]), []);

  return (
    <AsyncSection query={query}>
      {(household) => (
        <div>
          <PageHeader eyebrow={household.code} title="Profile" description="House representative details and family members." />
          <ProfileEditor household={household} onChanged={() => query.reload()} />
        </div>
      )}
    </AsyncSection>
  );
}
