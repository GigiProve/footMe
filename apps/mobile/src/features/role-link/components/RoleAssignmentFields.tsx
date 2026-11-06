import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, Input, Radio } from "../../../ui";
import { InviteFieldRow } from "../../dashboard/invites/components/InviteFieldRow";
import { ROLE_LINK_COPY } from "../role-link-presentation";
import type {
  RoleCatalog,
  RoleIdentity,
  RoleProfileType,
  RoleScopeType,
  RoleTeamOption,
} from "../role-link-types";
import { RoleOptionSheet } from "./RoleOptionSheet";

export type RoleFieldsValue = {
  customRole: string;
  profileType: RoleProfileType | null;
  roleId: string | null;
  scopeType: RoleScopeType;
  teamId: string | null;
};

export type RoleFieldsErrors = Partial<
  Record<"customRole" | "profileType" | "roleId" | "scopeType" | "teamId", string>
>;

type Props = {
  catalog: RoleCatalog | null;
  errors?: RoleFieldsErrors;
  /**
   * `request` — la categoria è l'identità professionale reale della PERSON e
   * non può essere inventata (§10, §12). `manage` — il Tipo di ruolo evolve
   * l'incarico fra le quattro categorie (§10, §29).
   */
  mode: "request" | "manage";
  onChange: (next: RoleFieldsValue) => void;
  /** Solo in `request`: le identità realmente presenti (§12, §13). */
  identities?: readonly RoleIdentity[];
  teams: readonly RoleTeamOption[];
  value: RoleFieldsValue;
};

type OpenSheet = "profile" | "role" | "scope" | "team" | null;

const CATEGORY_OPTIONS: { id: RoleProfileType; label: string }[] = [
  { id: "player", label: "Calciatore" },
  { id: "coach", label: "Allenatore" },
  { id: "staff", label: "Staff" },
  { id: "director", label: "Dirigente" },
];

/**
 * I campi di un incarico, condivisi fra i due percorsi e i due actor
 * (§9, §29).
 *
 * «Utilizza un unico modello di configurazione, con modalità e permessi
 * espliciti, condiviso fra persona e società. Non creare quattro form per
 * categoria moltiplicati per due actor.»
 *
 * La matrice di §9 è qui e in nessun altro posto:
 *
 *   Calciatore / Allenatore → una squadra interna, nessun sottoruolo;
 *   Staff                   → un ruolo del catalogo + una squadra;
 *   Dirigente               → un ruolo del catalogo + Intera società oppure
 *                             una squadra specifica.
 *
 * «Se cambia categoria, elimina soltanto i campi incompatibili del draft,
 * senza riutilizzare inconsapevolmente un ruolo Staff come ruolo
 * Dirigente»: il cambio di categoria azzera ruolo e custom, e conserva la
 * squadra, che resta valida per tutte e quattro.
 */
export function RoleAssignmentFields({
  catalog,
  errors,
  identities,
  mode,
  onChange,
  teams,
  value,
}: Props) {
  const [sheet, setSheet] = useState<OpenSheet>(null);
  /* Selezione provvisoria dello sheet: §13 — «chiusura/back conserva la
     scelta precedentemente confermata». */
  const [pending, setPending] = useState<string | null>(null);

  const roles = (catalog?.roles ?? []).filter(
    (role) => role.profileType === value.profileType,
  );
  const selectedRole = roles.find((role) => role.roleId === value.roleId) ?? null;
  const needsRolePicker = value.profileType === "staff" || value.profileType === "director";
  const supportsSocietyScope = value.profileType === "director";
  const selectedTeam = teams.find((team) => team.teamId === value.teamId) ?? null;

  const identityOptions = identities ?? [];
  const singleIdentity = mode === "request" && identityOptions.length <= 1;

  function openSheet(next: Exclude<OpenSheet, null>, current: string | null) {
    setPending(current);
    setSheet(next);
  }

  function applyCategory(next: RoleProfileType) {
    /* Calciatore e Allenatore hanno una voce sola e statica: §9 e DAS-REV-19
       §19 vietano «un selector dove la scelta non esiste». Il ruolo viene
       quindi risolto qui, non chiesto. */
    const implicit = (catalog?.roles ?? []).find(
      (role) => role.profileType === next && !role.isCustom,
    );
    const auto = next === "player" || next === "coach" ? implicit?.roleId ?? null : null;

    onChange({
      ...value,
      customRole: "",
      profileType: next,
      roleId: auto,
      /* L'ambito societario esiste solo per il Dirigente (§9). */
      scopeType: next === "director" ? value.scopeType : "team",
      teamId: next === "director" && value.scopeType === "society" ? null : value.teamId,
    });
  }

  return (
    <View style={styles.block}>
      {mode === "request" ? (
        <InviteFieldRow
          error={errors?.profileType}
          label={ROLE_LINK_COPY.profileFieldLabel}
          /* §13: «La riga read-only Profilo non deve sembrare un campo
             disabilitato o un dropdown senza opzioni.» Senza `onPress` non è
             un controllo e non ha chevron. */
          onPress={
            singleIdentity
              ? null
              : () => openSheet("profile", value.profileType)
          }
          testID="role-field-profile"
          value={
            identityOptions.find((item) => item.profileType === value.profileType)
              ?.label ?? null
          }
        />
      ) : (
        <InviteFieldRow
          error={errors?.profileType}
          label={ROLE_LINK_COPY.roleTypeFieldLabel}
          onPress={() => openSheet("profile", value.profileType)}
          testID="role-field-type"
          value={
            CATEGORY_OPTIONS.find((item) => item.id === value.profileType)?.label ??
            null
          }
        />
      )}

      {needsRolePicker ? (
        <InviteFieldRow
          error={errors?.roleId}
          label={ROLE_LINK_COPY.roleFieldLabel}
          onPress={() => openSheet("role", value.roleId)}
          showDivider
          testID="role-field-role"
          value={selectedRole?.label ?? null}
        />
      ) : null}

      {/* §12: «Mostra il campo custom solo per Altro.» */}
      {selectedRole?.isCustom ? (
        <View style={styles.custom}>
          <Input
            accessibilityLabel={ROLE_LINK_COPY.customRoleFieldLabel}
            error={!!errors?.customRole}
            helperText={errors?.customRole}
            label={ROLE_LINK_COPY.customRoleFieldLabel}
            maxLength={catalog?.customRoleMax}
            onChangeText={(text) => onChange({ ...value, customRole: text })}
            testID="role-field-custom"
            value={value.customRole}
          />
        </View>
      ) : null}

      {/* §12, screen 05: i radio dell'ambito sono in pagina, non in uno
          sheet — il mockup li mostra aperti e la scelta cambia la forma del
          form sotto. */}
      {supportsSocietyScope ? (
        <View style={styles.scope}>
          <AppText color="neutralMuted" variant="meta">
            {ROLE_LINK_COPY.scopeFieldLabel}
          </AppText>

          <Radio
            checked={value.scopeType === "society"}
            label={ROLE_LINK_COPY.societyScope}
            onPress={() =>
              onChange({ ...value, scopeType: "society", teamId: null })
            }
            testID="role-scope-society"
            tone="neutral"
          />

          <Radio
            checked={value.scopeType === "team"}
            label={ROLE_LINK_COPY.teamScope}
            onPress={() => onChange({ ...value, scopeType: "team" })}
            testID="role-scope-team"
            tone="neutral"
          />

          {errors?.scopeType ? (
            <AppText accessibilityRole="alert" color="danger" variant="meta">
              {errors.scopeType}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* §12, screen 05: «Nel master è selezionata Intera società: non
          mostrare né inviare il campo Squadra.» */}
      {value.scopeType === "team" ? (
        <InviteFieldRow
          error={errors?.teamId}
          label={ROLE_LINK_COPY.teamFieldLabel}
          onPress={() => openSheet("team", value.teamId)}
          showDivider
          testID="role-field-team"
          value={selectedTeam?.label ?? null}
        />
      ) : null}

      <RoleOptionSheet
        emptyMessage="Nessun profilo disponibile"
        onClose={() => setSheet(null)}
        onConfirm={() => {
          if (pending) applyCategory(pending as RoleProfileType);
          setSheet(null);
        }}
        onSelect={setPending}
        options={
          mode === "request"
            ? identityOptions.map((item) => ({
                id: item.profileType,
                label: item.label,
              }))
            : CATEGORY_OPTIONS.map((item) => ({ id: item.id, label: item.label }))
        }
        selected={pending}
        testID="role-sheet-profile"
        title={
          mode === "request"
            ? ROLE_LINK_COPY.profileSheetTitle
            : ROLE_LINK_COPY.roleTypeSheetTitle
        }
        visible={sheet === "profile"}
      />

      <RoleOptionSheet
        emptyMessage="Nessun ruolo disponibile"
        onClose={() => setSheet(null)}
        onConfirm={() => {
          const next = roles.find((role) => role.roleId === pending);

          onChange({
            ...value,
            /* Cambiando ruolo il custom di un altro "Altro…" non resta
               appeso (§9). */
            customRole: next?.isCustom ? value.customRole : "",
            roleId: pending,
          });
          setSheet(null);
        }}
        onSelect={setPending}
        options={roles.map((role) => ({ id: role.roleId, label: role.label }))}
        selected={pending}
        testID="role-sheet-role"
        title={ROLE_LINK_COPY.roleSheetTitle}
        visible={sheet === "role"}
      />

      <RoleOptionSheet
        emptyMessage="Nessuna squadra disponibile"
        onClose={() => setSheet(null)}
        onConfirm={() => {
          onChange({ ...value, teamId: pending });
          setSheet(null);
        }}
        onSelect={setPending}
        options={teams.map((team) => ({
          id: team.teamId,
          label: team.label,
          meta: team.category,
        }))}
        selected={pending}
        testID="role-sheet-team"
        title={ROLE_LINK_COPY.teamSheetTitle}
        visible={sheet === "team"}
      />
    </View>
  );
}

/**
 * Validazione del draft, condivisa fra form e riepilogo (§12, §29).
 *
 * Il server rivalida tutto (§15): questa funzione serve a mostrare l'errore
 * accanto al campo, non a decidere se l'operazione è lecita.
 */
export function validateRoleFields(
  value: RoleFieldsValue,
  catalog: RoleCatalog | null,
): RoleFieldsErrors {
  const errors: RoleFieldsErrors = {};
  const role = (catalog?.roles ?? []).find((item) => item.roleId === value.roleId);

  if (!value.profileType) {
    errors.profileType = "Seleziona un profilo.";
  }

  if (!value.roleId) {
    errors.roleId = "Seleziona un ruolo.";
  }

  if (role?.isCustom) {
    const trimmed = value.customRole.trim();

    if (trimmed.length === 0) {
      errors.customRole = "Specifica il ruolo.";
    } else if (catalog && trimmed.length > catalog.customRoleMax) {
      errors.customRole = "Controlla il ruolo inserito.";
    }
  }

  if (value.scopeType === "team" && !value.teamId) {
    errors.teamId = "Seleziona una squadra.";
  }

  return errors;
}

export function hasFieldErrors(errors: RoleFieldsErrors): boolean {
  return Object.keys(errors).length > 0;
}

const styles = StyleSheet.create({
  block: {
    paddingTop: spacing[8],
  },
  custom: {
    paddingBottom: spacing[8],
    paddingTop: spacing[4],
  },
  scope: {
    borderTopColor: "transparent",
    gap: spacing[8],
    paddingTop: spacing[16],
  },
});
