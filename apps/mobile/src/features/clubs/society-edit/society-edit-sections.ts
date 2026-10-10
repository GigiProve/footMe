/**
 * Registro delle nove voci dell'hub Modifica profilo Società (REV-PROF-18,
 * schermata 1), in due macroaree.
 *
 * La differenza fra i due gruppi non è grafica: "Profilo" raccoglie i cinque
 * moduli che salvano qui, "Gestione collegata" è fatta di soli entry point ai
 * flussi che esistono già. Nessuna di quelle quattro righe apre una versione
 * semplificata del proprio dominio, e la rotta è l'unico punto in cui si
 * dichiara dove porta.
 *
 * Non esiste una voce "Organico": rosa e staff appartengono alla singola
 * squadra e si gestiscono entrandoci.
 */
import type {
  ProfileEditHubGroup,
  ProfileEditHubSection,
} from "../../profiles/edit/ProfileEditHubScreen";

export type SocietyEditSection = ProfileEditHubSection;

/**
 * I cinque moduli, con la rotta tenuta a parte dal resto della voce.
 *
 * Serve a un caso solo, ma reale: un amministratore delegato non è
 * `club_admin` e non ha un club in sessione, quindi apre l'hub dalla rotta
 * pubblica della Società passando l'id. Le rotte dei moduli devono portarlo
 * avanti, altrimenti la seconda schermata non saprebbe più quale club si sta
 * modificando — e un `Href` con parametri non è una stringa concatenata.
 */
const MODULE_SECTIONS = [
  {
    icon: "shield-outline",
    id: "identity",
    pathname: "/profile/society-edit/identity",
    subtitle: "Logo, copertina, nome e colori",
    title: "Identità del club",
  },
  {
    icon: "football-outline",
    id: "sport",
    pathname: "/profile/society-edit/sport",
    subtitle: "Struttura, categoria e squadre",
    title: "Profilo sportivo",
  },
  {
    icon: "location-outline",
    id: "venue",
    pathname: "/profile/society-edit/venue",
    subtitle: "Città, sede e campo principale",
    title: "Sede e impianto",
  },
  {
    icon: "document-text-outline",
    id: "description",
    pathname: "/profile/society-edit/description",
    subtitle: "Presentazione del club",
    title: "Descrizione",
  },
  {
    // Sottotitolo a conteggio: "3 contatti visibili".
    icon: "call-outline",
    id: "contacts",
    pathname: "/profile/society-edit/contacts",
    title: "Contatti pubblici",
  },
] as const satisfies readonly (Omit<ProfileEditHubSection, "route"> & {
  pathname: string;
})[];

/**
 * I quattro flussi collegati. Sono rotte di altri domini: qui c'è solo la
 * porta, e non è questo il punto in cui cambiarne la firma.
 */
const LINKED_SECTIONS: readonly ProfileEditHubSection[] = [
  {
    // Gestione Squadre esistente: creare, modificare e archiviare una squadra
    // resta suo.
    icon: "people-outline",
    id: "teams",
    route: "/(tabs)/dashboard/teams",
    title: "Squadre del club",
  },
  {
    // DAS-REV-11 §2: la gestione dei collegamenti è il centro Rete
    // societaria, non più l'elenco manuale delle affiliate.
    icon: "git-network-outline",
    id: "affiliates",
    route: "/(tabs)/dashboard/network",
    title: "Società collegate",
  },
  {
    // Gestione Posizioni già completata: annunci e candidature non si
    // riprogettano qui.
    icon: "megaphone-outline",
    id: "positions",
    route: "/(tabs)/announcements",
    title: "Posizioni",
  },
  {
    // Modulo Media condiviso (REV-PROF-12), aperto sulla scheda contenuti del
    // Master Profile: nessuna galleria specifica della Società.
    icon: "play-circle-outline",
    id: "media",
    route: { params: { tab: "media" }, pathname: "/(tabs)/profile" },
    title: "Media e contenuti",
  },
];

/**
 * Le voci dell'hub.
 *
 * `canOpenClubAdmin` non e' un permesso: e' il fatto che lo stack
 * `/club-admin` sia raggiungibile. Quel layout e' ancora gated sul ruolo
 * `club_admin` — rivederlo e' fuori dallo scopo di REV-PROF-18, che non
 * ridisegna i permessi amministratori — quindi a un amministratore delegato
 * quelle due righe non si mostrano: una riga che rimbalza alla root e' peggio
 * di una riga assente, e il flusso resta raggiungibile dalla sua area
 * gestionale.
 */
export function buildSocietyEditSectionGroups(
  clubId: string | null,
  options: { canOpenClubAdmin: boolean } = { canOpenClubAdmin: true },
): readonly ProfileEditHubGroup[] {
  // DAS-REV-11 §2: "Società collegate" non passa più da /club-admin — punta
  // al centro Rete societaria, che si protegge da sé con `network_view`.
  // Resta filtrata la sola riga che dipende davvero da quello stack.
  const linked = options.canOpenClubAdmin
    ? LINKED_SECTIONS
    : LINKED_SECTIONS.filter((section) => section.id !== "teams");

  return [
    {
      sections: MODULE_SECTIONS.map(({ pathname, ...section }) => ({
        ...section,
        route: {
          params: clubId ? { clubId } : {},
          pathname,
        },
      })),
      title: "Profilo",
    },
    {
      sections: linked,
      title: "Gestione collegata",
    },
  ];
}
