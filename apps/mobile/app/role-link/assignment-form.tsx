/** Form condiviso di modifica e aggiunta (master 16, 17). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { AssignmentFormScreen } from "../../src/features/role-link/roles/AssignmentFormScreen";

export default function AssignmentFormRoute() {
  const router = useRouter();
  const { assignmentId, clubId, mode, profileId } = useLocalSearchParams<{
    assignmentId?: string;
    clubId?: string;
    mode?: string;
    profileId?: string;
  }>();

  const resolvedMode = mode === "add" ? "add" : "edit";
  const hasTarget =
    resolvedMode === "edit"
      ? typeof assignmentId === "string" && assignmentId.length > 0
      : typeof clubId === "string" && clubId.length > 0;

  if (!hasTarget) {
    return (
      <DashboardGlobalError
        body="Riapri il form dal rapporto con la società."
        onRetry={() => router.back()}
        title="Ruolo non disponibile"
      />
    );
  }

  return (
    <AssignmentFormScreen
      assignmentId={typeof assignmentId === "string" ? assignmentId : null}
      clubId={typeof clubId === "string" ? clubId : null}
      mode={resolvedMode}
      profileId={typeof profileId === "string" ? profileId : null}
    />
  );
}
