/**
 * Stati di caricamento ed errore dei moduli dell'editor Allenatore
 * (REV-PROF-05, "Loading state" / "Error state").
 *
 * La forma vive in `edit/ProfileEditStates`, condivisa con lo Staff tecnico:
 * qui restano soltanto i testID dell'Allenatore, su cui poggiano i suoi test.
 */
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../edit/ProfileEditStates";

/** Scheletro delle righe di un form: etichetta corta + campo. */
export function CoachEditFieldsSkeleton({ rows = 4 }: { rows?: number }) {
  return <ProfileEditFieldsSkeleton rows={rows} testID="coach-edit-skeleton" />;
}

export function CoachEditErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <ProfileEditErrorState
      message={message}
      onRetry={onRetry}
      testID="coach-edit-error"
    />
  );
}
