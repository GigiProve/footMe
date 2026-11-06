/** Il singolo incarico lato Società (master 22). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../../src/features/dashboard/components/DashboardStates";
import { SocietyAssignmentScreen } from "../../../src/features/role-link/society/SocietyAssignmentScreen";

export default function SocietyAssignmentRoute() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams<{ assignmentId?: string }>();

  if (typeof assignmentId !== "string" || assignmentId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri l'incarico dal rapporto della persona."
        onRetry={() => router.back()}
        title="Incarico non disponibile"
      />
    );
  }

  return <SocietyAssignmentScreen assignmentId={assignmentId} />;
}
