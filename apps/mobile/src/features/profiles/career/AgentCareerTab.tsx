/**
 * Tab Carriera del Master Profile Procuratore (REV-PROF-13, Screen 2).
 *
 * "Percorso da procuratore": l'incarico in corso, gli assistiti pubblici in
 * evidenza con l'accesso al portfolio completo, e le esperienze precedenti.
 * Non è una terza timeline: usa i blocchi di sezione condivisi dagli altri
 * Master Profile, con un blocco esperienza proprio perché il Procuratore
 * ragiona per periodi datati e non per stagioni sportive.
 *
 * Il selettore dei percorsi compare solo quando esistono carriere aggiuntive —
 * da REV-PROF-15 anche quelle da dirigente, allenatore e staff tecnico, ognuna
 * con il renderer già approvato per il suo modello — e sparisce del tutto per
 * chi ha il solo percorso da procuratore, invece di lasciare una chip che non
 * sceglie niente.
 */
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import { ProfileFilterChips } from "../master/ProfileFilterChips";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import type { AgentPublicAssistito } from "../../relationships/agent-representation-service";
import { getRelationshipTypeLabel } from "../../relationships/agent-representation-service";
import { getPlayerPositionLabel } from "../player-sports";
import { CareerTotals } from "./CareerTotals";
import { CoachCareerExperienceBlock } from "./CoachCareerExperienceBlock";
import type { CoachCareerView } from "./coach-career-model";
import { PlayerCareerExperience } from "./PlayerCareerExperience";
import { buildPlayerCareerView } from "./player-career-model";
import {
  formatAgentOrganizationLabel,
  getAvailableAgentPaths,
  type AgentCareerExperience,
  type AgentCareerPath,
  type AgentProfileCareer,
} from "./agent-career-model";

/** Quanti assistiti stanno in evidenza prima di rimandare al portfolio. */
const HIGHLIGHTED_ASSISTITI = 3;

const PATH_LABELS: Record<AgentCareerPath, string> = {
  agent: "Procuratore",
  coach: "Allenatore",
  director: "Dirigente",
  other: "Altri ruoli",
  player: "Calciatore",
  staff: "Staff tecnico",
};

const PATH_TITLES: Record<AgentCareerPath, string> = {
  agent: "Percorso da procuratore",
  coach: "Percorso da allenatore",
  director: "Percorso dirigenziale",
  other: "Altre esperienze nel calcio",
  player: "Percorso da calciatore",
  staff: "Percorso nello staff tecnico",
};

type AgentCareerTabProps = {
  /** Portfolio pubblico già risolto: owner e visitor leggono lo stesso elenco. */
  assistiti: readonly AgentPublicAssistito[];
  /** Il caricamento del portfolio è fallito: errore locale, tab navigabile. */
  assistitiFailed?: boolean;
  career: AgentProfileCareer;
  isAssistitiLoading?: boolean;
  isOwner: boolean;
  /** Entry point esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  /** Entry point esistente alla gestione assistiti. Solo Owner. */
  onManageAssistiti?: () => void;
  /** Apre il portfolio completo: owner e visitor, con permessi diversi. */
  onOpenAllAssistiti?: () => void;
  onOpenAssistito?: (playerProfileId: string) => void;
  onPathChange: (path: AgentCareerPath) => void;
  onRetryAssistiti?: () => void;
  /** Percorso attivo: lo possiede la vista a tab, così i Dettagli lo guidano. */
  path: AgentCareerPath;
};

export function AgentCareerTab({
  assistiti,
  assistitiFailed = false,
  career,
  isAssistitiLoading = false,
  isOwner,
  onAddExperience,
  onManageAssistiti,
  onOpenAllAssistiti,
  onOpenAssistito,
  onPathChange,
  onRetryAssistiti,
  path,
}: AgentCareerTabProps) {
  const availablePaths = getAvailableAgentPaths(career);
  // Un percorso che sparisce non lascia la tab appesa a una vista che non
  // esiste più: si torna al percorso da procuratore.
  const activePath = availablePaths.includes(path) ? path : "agent";

  /*
    Un errore nella carriera da ex calciatore non si porta via quella da
    procuratore: la costruzione è isolata e, se fallisce, il resto della tab
    resta intatto e navigabile.
  */
  const playerCareer = useMemo(() => {
    if (career.playerForms.length === 0) {
      return null;
    }

    try {
      return buildPlayerCareerView([...career.playerForms]);
    } catch {
      return null;
    }
  }, [career.playerForms]);

  return (
    <View style={styles.section} testID="agent-career-tab">
      <AppText accessibilityRole="header" variant="titleMd">
        {PATH_TITLES[activePath]}
      </AppText>

      {availablePaths.length > 1 ? (
        <ProfileFilterChips
          accessibilityLabel="Percorso professionale"
          onChange={onPathChange}
          options={availablePaths.map((value) => ({
            label: PATH_LABELS[value],
            value,
          }))}
          testID="agent-career-path"
          value={activePath}
        />
      ) : null}

      {activePath === "director" ? (
        <ExperienceList testIDPrefix="agent-director" view={career.director} />
      ) : activePath === "coach" ? (
        <ExperienceList testIDPrefix="agent-coach" view={career.coach} />
      ) : activePath === "staff" ? (
        <ExperienceList testIDPrefix="agent-staff" view={career.staff} />
      ) : activePath === "agent" ? (
        <AgentCareerBody
          assistiti={assistiti}
          assistitiFailed={assistitiFailed}
          career={career}
          isAssistitiLoading={isAssistitiLoading}
          isOwner={isOwner}
          onAddExperience={onAddExperience}
          onManageAssistiti={onManageAssistiti}
          onOpenAllAssistiti={onOpenAllAssistiti}
          onOpenAssistito={onOpenAssistito}
          onRetryAssistiti={onRetryAssistiti}
        />
      ) : playerCareer ? (
        <View>
          {playerCareer.experiences.map((experience, index) => (
            <PlayerCareerExperience
              experience={experience}
              isLast={index === playerCareer.experiences.length - 1}
              key={experience.id}
            />
          ))}
          {/* Le statistiche vivono solo nel percorso da calciatore. */}
          <CareerTotals totals={playerCareer.totals} />
        </View>
      ) : (
        <ProfileSectionError
          message="Non è stato possibile mostrare la carriera da calciatore."
          testID="agent-player-career-error"
        />
      )}
    </View>
  );
}

/**
 * Un percorso aggiuntivo: lo stesso blocco esperienza di Allenatore, Staff
 * tecnico e Dirigente, perché è lo stesso modello. Nessuna versione
 * semplificata ricreata qui.
 */
function ExperienceList({
  testIDPrefix,
  view,
}: {
  testIDPrefix: string;
  view: CoachCareerView;
}) {
  return (
    <View>
      {view.experiences.map((experience, index) => (
        <CoachCareerExperienceBlock
          experience={experience}
          isLast={index === view.experiences.length - 1}
          key={experience.id}
          testIDPrefix={testIDPrefix}
        />
      ))}
    </View>
  );
}

function AgentCareerBody({
  assistiti,
  assistitiFailed,
  career,
  isAssistitiLoading,
  isOwner,
  onAddExperience,
  onManageAssistiti,
  onOpenAllAssistiti,
  onOpenAssistito,
  onRetryAssistiti,
}: {
  assistiti: readonly AgentPublicAssistito[];
  assistitiFailed: boolean;
  career: AgentProfileCareer;
  isAssistitiLoading: boolean;
  isOwner: boolean;
  onAddExperience?: () => void;
  onManageAssistiti?: () => void;
  onOpenAllAssistiti?: () => void;
  onOpenAssistito?: (playerProfileId: string) => void;
  onRetryAssistiti?: () => void;
}) {
  const { currentExperience, previousExperiences } = career;

  if (career.experiences.length === 0) {
    return (
      <View style={styles.empty} testID="agent-career-empty">
        <AppText variant="titleMd">
          {isOwner ? "Completa la tua carriera" : "Nessuna esperienza disponibile"}
        </AppText>
        <AppText color="secondary" variant="bodySm">
          {isOwner
            ? "Aggiungi le tue esperienze per raccontare il tuo percorso professionale."
            : "Questo profilo non ha ancora aggiunto esperienze professionali."}
        </AppText>
        {/* Nessuna CTA di modifica al Visitor, nemmeno a carriera vuota. */}
        {isOwner && onAddExperience ? (
          <Button
            label="Aggiungi esperienza"
            onPress={onAddExperience}
            size="sm"
            testID="agent-career-add"
            variant="secondary"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.body}>
      {currentExperience ? (
        <AgentExperienceBlock
          assistitiCount={assistiti.length}
          experience={currentExperience}
          testID="agent-career-current"
        />
      ) : null}

      <AssistitiHighlights
        assistiti={assistiti}
        hasFailed={assistitiFailed}
        isLoading={isAssistitiLoading}
        isOwner={isOwner}
        onManageAssistiti={onManageAssistiti}
        onOpenAllAssistiti={onOpenAllAssistiti}
        onOpenAssistito={onOpenAssistito}
        onRetry={onRetryAssistiti}
      />

      {previousExperiences.length > 0 ? (
        <View style={styles.previous} testID="agent-career-previous">
          <AppText accessibilityRole="header" variant="titleSm">
            Esperienze precedenti
          </AppText>
          {previousExperiences.map((experience) => (
            <AgentExperienceBlock
              experience={experience}
              key={experience.id}
              testID={`agent-career-experience-${experience.id}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Un incarico: organizzazione, ruolo, periodo e — solo per quello in corso —
 * quanti assistiti pubblici ci sono dietro. Un indipendente non ha un logo da
 * mostrare, quindi al suo posto c'è l'iniziale della modalità, non un
 * quadrato vuoto che sembra un'immagine mancante.
 */
function AgentExperienceBlock({
  assistitiCount,
  experience,
  testID,
}: {
  assistitiCount?: number;
  experience: AgentCareerExperience;
  testID?: string;
}) {
  const organizationLabel = formatAgentOrganizationLabel(experience);
  const metaLine = [experience.periodLabel, experience.role]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.experience} testID={testID}>
      <Avatar
        name={organizationLabel}
        size="md"
        uri={experience.logoUrl ?? undefined}
      />
      <View style={styles.experienceBody}>
        <AppText numberOfLines={2} variant="titleSm">
          {organizationLabel}
        </AppText>
        {metaLine ? (
          <AppText color="secondary" variant="bodySm">
            {metaLine}
          </AppText>
        ) : null}
        {typeof assistitiCount === "number" && assistitiCount > 0 ? (
          <AppText color="secondary" variant="bodySm">
            {assistitiCount === 1 ? "1 assistito" : `${assistitiCount} assistiti`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Assistiti in evidenza (REV-PROF-13 §"Assistiti in evidenza").
 *
 * Solo relazioni accettate, attive e pubbliche: l'elenco arriva già filtrato
 * dal backend, perché una richiesta pendente o una relazione privata non deve
 * nemmeno attraversare il client del profilo pubblico. Nessuna statistica da
 * calciatore dentro la riga: nome, ruolo in campo, squadra e tipo di rapporto.
 */
function AssistitiHighlights({
  assistiti,
  hasFailed,
  isLoading,
  isOwner,
  onManageAssistiti,
  onOpenAllAssistiti,
  onOpenAssistito,
  onRetry,
}: {
  assistiti: readonly AgentPublicAssistito[];
  hasFailed: boolean;
  isLoading: boolean;
  isOwner: boolean;
  onManageAssistiti?: () => void;
  onOpenAllAssistiti?: () => void;
  onOpenAssistito?: (playerProfileId: string) => void;
  onRetry?: () => void;
}) {
  if (hasFailed) {
    return (
      <ProfileSectionError
        message="Non è stato possibile caricare il portfolio assistiti."
        onRetry={onRetry}
        testID="agent-assistiti-error"
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.assistitiSkeleton} testID="agent-assistiti-loading">
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.assistitiSkeletonRow} />
        ))}
      </View>
    );
  }

  if (assistiti.length === 0) {
    return (
      <View style={styles.empty} testID="agent-assistiti-empty">
        <AppText variant="titleSm">
          {isOwner ? "Il tuo portfolio è ancora vuoto" : "Nessun assistito pubblico"}
        </AppText>
        <AppText color="secondary" variant="bodySm">
          {isOwner
            ? "Aggiungi o collega i tuoi assistiti per valorizzare il tuo profilo professionale."
            : "Questo Procuratore non ha ancora assistiti visibili nel portfolio."}
        </AppText>
        {/* Nessuna CTA gestionale al Visitor. */}
        {isOwner && onManageAssistiti ? (
          <Button
            label="Gestisci assistiti"
            onPress={onManageAssistiti}
            size="sm"
            testID="agent-assistiti-manage"
            variant="secondary"
          />
        ) : null}
      </View>
    );
  }

  const highlighted = assistiti.slice(0, HIGHLIGHTED_ASSISTITI);

  return (
    <View style={styles.assistiti} testID="agent-assistiti">
      <AppText accessibilityRole="header" variant="titleSm">
        Assistiti in evidenza
      </AppText>

      {highlighted.map((item, index) => {
        const name = item.player_full_name ?? "Giocatore";
        const metaLine = [
          item.primary_position
            ? getPlayerPositionLabel(item.primary_position)
            : null,
          item.current_team,
        ]
          .filter(Boolean)
          .join(" · ");
        const relationLabel = getRelationshipTypeLabel(item.relationship_type);

        return (
          <Pressable
            accessibilityLabel={`${name}, ${relationLabel}${metaLine ? `, ${metaLine}` : ""}`}
            accessibilityRole="button"
            disabled={!onOpenAssistito}
            key={item.id}
            onPress={
              onOpenAssistito
                ? () => onOpenAssistito(item.player_profile_id)
                : undefined
            }
            style={({ pressed }) => [
              styles.assistitoRow,
              index === highlighted.length - 1 ? styles.assistitoRowLast : null,
              pressed ? styles.assistitoRowPressed : null,
            ]}
            testID={`agent-assistito-${item.player_profile_id}`}
          >
            <Avatar
              name={name}
              size="md"
              uri={item.player_avatar_url ?? undefined}
            />
            <View style={styles.assistitoBody}>
              <AppText numberOfLines={1} variant="titleSm">
                {name}
              </AppText>
              {metaLine ? (
                <AppText color="secondary" numberOfLines={1} variant="bodySm">
                  {metaLine}
                </AppText>
              ) : null}
            </View>
            <View style={styles.relationPill}>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {relationLabel}
              </AppText>
            </View>
          </Pressable>
        );
      })}

      {onOpenAllAssistiti ? (
        <Button
          label="Vedi tutti gli assistiti"
          onPress={onOpenAllAssistiti}
          size="sm"
          testID="agent-assistiti-see-all"
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  assistiti: {
    gap: spacing[8],
    paddingTop: spacing[8],
  },
  assistitiSkeleton: {
    gap: spacing[8],
    paddingTop: spacing[8],
  },
  assistitiSkeletonRow: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[12],
    height: 56,
  },
  assistitoBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  assistitoRow: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingVertical: spacing[10],
  },
  assistitoRowLast: {
    borderBottomWidth: 0,
  },
  assistitoRowPressed: {
    opacity: 0.6,
  },
  body: {
    gap: spacing[12],
  },
  empty: {
    alignItems: "flex-start",
    gap: spacing[8],
    paddingVertical: spacing[16],
  },
  experience: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  experienceBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  previous: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[4],
    paddingTop: spacing[12],
  },
  relationPill: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius.full,
    maxWidth: 132,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingBottom: spacing[18],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[18],
  },
});
