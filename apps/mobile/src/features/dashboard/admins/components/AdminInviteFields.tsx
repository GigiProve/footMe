import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { Button } from "../../../../ui";
import { ADMIN_COPY, SCOPE_MODE_LABEL } from "../admins-presentation";
import type {
  AdminScopeMode,
  AssignableRole,
  AssignableTeam,
} from "../admins-types";
import { AdminFieldRow } from "./AdminFieldRow";
import { AdminOptionSheet } from "./AdminOptionSheet";

type Props = {
  /** Errori per campo, già localizzati (§30). */
  errors?: { role?: string | null; scope?: string | null };
  onRoleChange: (roleId: string) => void;
  onScopeModeChange: (mode: AdminScopeMode) => void;
  onTeamsChange: (teamIds: string[]) => void;
  /** `true` sulla ricondivisione: la proposta è in sola lettura (§12). */
  readOnly?: boolean;
  roleId: string | null;
  roles: readonly AssignableRole[];
  /** Etichette già risolte, usate quando la proposta è read-only. */
  readOnlyLabels?: { role: string | null; scope: string | null };
  scopeMode: AdminScopeMode;
  teamIds: readonly string[];
  teams: readonly AssignableTeam[];
};

/**
 * I due selector della proposta: Ruolo e Ambito (§9, §10).
 *
 * Un componente solo per l'invito interno e per quello esterno, perché §12
 * chiede di riusare «le stesse regole di ruolo, scope e assegnabilità
 * dell'invito interno». Due copie divergerebbero alla prima correzione.
 *
 * «Mantieni ruolo e ambito indipendenti durante la compilazione» (§10):
 * cambiare ruolo non tocca l'ambito e viceversa. Non c'è nessun allargamento
 * automatico a Intera società.
 */
export function AdminInviteFields({
  errors,
  onRoleChange,
  onScopeModeChange,
  onTeamsChange,
  readOnly = false,
  readOnlyLabels,
  roleId,
  roles,
  scopeMode,
  teamIds,
  teams,
}: Props) {
  const [sheet, setSheet] = useState<"role" | "scope" | "teams" | null>(null);

  const roleLabel = useMemo(() => {
    if (readOnly) {
      return readOnlyLabels?.role ?? null;
    }

    return roles.find((role) => role.roleId === roleId)?.name ?? null;
  }, [readOnly, readOnlyLabels?.role, roleId, roles]);

  /**
   * §10: «Il riepilogo può mostrare un nome per un Team, pochi nomi se
   * leggibili, oppure "3 squadre" con accesso alla selezione.» La stessa
   * regola di `club_admin_scope_label` lato server, applicata alla proposta
   * ancora in compilazione.
   */
  const scopeLabel = useMemo(() => {
    if (readOnly) {
      return readOnlyLabels?.scope ?? null;
    }

    if (scopeMode === "society") {
      return SCOPE_MODE_LABEL.society;
    }

    const names = teams
      .filter((team) => teamIds.includes(team.teamId))
      .map((team) => team.name);

    if (names.length === 0) {
      return null;
    }

    return names.length <= 2
      ? names.join(" · ")
      : `${names.length} squadre`;
  }, [readOnly, readOnlyLabels?.scope, scopeMode, teamIds, teams]);

  return (
    <View style={styles.block}>
      <AdminFieldRow
        error={errors?.role}
        label={ADMIN_COPY.roleLabel}
        onPress={readOnly ? undefined : () => setSheet("role")}
        testID="admin-invite-role"
        value={roleLabel}
      />

      <AdminFieldRow
        error={errors?.scope}
        label={ADMIN_COPY.scopeLabel}
        onPress={readOnly ? undefined : () => setSheet("scope")}
        testID="admin-invite-scope"
        value={scopeLabel}
      />

      {/* §10: la selezione delle squadre è un secondo passo, non una terza
          modalità. "Primavera" è il nome di un Team, non un tipo di scope. */}
      {!readOnly && scopeMode === "teams" ? (
        <Button
          label="Scegli le squadre"
          onPress={() => setSheet("teams")}
          size="sm"
          testID="admin-invite-pick-teams"
          variant="link"
        />
      ) : null}

      <AdminOptionSheet
        emptyMessage="Non ci sono ruoli disponibili per questo invito."
        onClose={() => setSheet(null)}
        onToggle={onRoleChange}
        options={roles.map((role) => ({ id: role.roleId, label: role.name }))}
        selected={roleId ? [roleId] : []}
        title={ADMIN_COPY.roleLabel}
        visible={sheet === "role"}
      />

      <AdminOptionSheet
        emptyMessage="Nessun ambito disponibile."
        onClose={() => setSheet(null)}
        onToggle={(id) => {
          onScopeModeChange(id as AdminScopeMode);

          if (id === "teams") {
            setSheet("teams");

            return;
          }
        }}
        options={[
          { id: "society", label: SCOPE_MODE_LABEL.society },
          { id: "teams", label: SCOPE_MODE_LABEL.teams },
        ]}
        selected={[scopeMode]}
        title={ADMIN_COPY.scopeLabel}
        visible={sheet === "scope"}
      />

      <AdminOptionSheet
        emptyMessage="Non ci sono squadre selezionabili."
        multiple
        onClose={() => setSheet(null)}
        onToggle={(id) =>
          onTeamsChange(
            teamIds.includes(id)
              ? teamIds.filter((teamId) => teamId !== id)
              : [...teamIds, id],
          )
        }
        options={teams.map((team) => ({
          id: team.teamId,
          label: team.name,
          meta: team.category,
        }))}
        selected={teamIds}
        title={SCOPE_MODE_LABEL.teams}
        visible={sheet === "teams"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[16],
  },
});
