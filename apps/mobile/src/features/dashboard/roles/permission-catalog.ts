/**
 * Risoluzione dei livelli dal catalogo (§7, §12).
 *
 * Queste funzioni sono il gemello client di `club_permission_area_level`,
 * `club_permission_active_controls` e `club_permission_expand_controls`.
 * Esistono per una ragione sola: un editor vivo deve poter dire «Gestisci»
 * mentre l'utente tocca le checkbox, e il server non è nel ciclo.
 *
 * **Il server resta l'autorità.** Il comando riceve id di controllo, li
 * riespande, ne ricalcola le chiavi e rifiuta ciò che l'actor non può
 * concedere: §7 dice che «la classificazione dipende dal set risolto e dalla
 * revisione della tassonomia, non dalla sola stringa salvata dal client», e
 * infatti nessun livello viene mai inviato. Qui si calcola un'anteprima
 * sugli stessi dati che il server ha appena mandato, non una verità
 * parallela.
 */
import type {
  AreaLevel,
  AreaLevelChange,
  PermissionArea,
  PermissionCatalog,
  PermissionControl,
} from "./roles-types";

/** Controlli del bundle rapido di un'area. `none` non ha controlli. */
export function bundleControls(
  area: PermissionArea,
  level: Exclude<AreaLevel, "custom">,
): string[] {
  if (level === "none") {
    return [];
  }

  return area.controls
    .filter((control) => level === "manage" || control.bundle === "view")
    .map((control) => control.id);
}

/**
 * Chiusura transitiva delle dipendenze (§12).
 *
 * «Attivare una capability seleziona anche le dipendenze obbligatorie.» Il
 * limite di profondità non è difensivismo decorativo: un ciclo introdotto da
 * una revisione futura del catalogo bloccherebbe l'app invece di salvare un
 * ruolo leggermente sbagliato.
 */
export function expandControls(
  area: PermissionArea,
  controlIds: readonly string[],
): string[] {
  const byId = new Map(area.controls.map((control) => [control.id, control]));
  const result = new Set<string>();
  let frontier = controlIds.filter((id) => byId.has(id));
  let depth = 0;

  while (frontier.length > 0 && depth < 16) {
    const next: string[] = [];

    for (const id of frontier) {
      if (result.has(id)) {
        continue;
      }

      result.add(id);
      next.push(...(byId.get(id)?.requires ?? []));
    }

    frontier = next.filter((id) => byId.has(id) && !result.has(id));
    depth += 1;
  }

  return area.controls
    .filter((control) => result.has(control.id))
    .map((control) => control.id);
}

/**
 * Controlli che un set di controlli attivi rende **obbligatori**.
 *
 * §12: «Una dipendenza richiesta resta selezionata e non disattivabile
 * finché serve.» Non è la stessa cosa di "è attiva": un controllo può essere
 * attivo per scelta e non essere richiesto da nessuno.
 */
export function lockedControls(
  area: PermissionArea,
  controlIds: readonly string[],
): string[] {
  const active = new Set(controlIds);
  const locked = new Set<string>();

  for (const control of area.controls) {
    if (!active.has(control.id)) {
      continue;
    }

    for (const required of control.requires) {
      if (active.has(required)) {
        locked.add(required);
      }
    }
  }

  return [...locked];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const set = new Set(a);

  return b.every((value) => set.has(value));
}

/** Livello effettivo di un'area a partire dai controlli attivi (§7). */
export function areaLevel(
  area: PermissionArea,
  controlIds: readonly string[],
): AreaLevel {
  const active = area.controls
    .filter((control) => controlIds.includes(control.id))
    .map((control) => control.id);

  if (active.length === 0) {
    return "none";
  }

  if (sameSet(active, bundleControls(area, "manage"))) {
    return "manage";
  }

  if (sameSet(active, bundleControls(area, "view"))) {
    return "view";
  }

  return "custom";
}

/**
 * Controlli attivi derivati da una configurazione **già salvata**.
 *
 * Un controllo è attivo solo se il set contiene **tutte** le sue chiavi:
 * metà di un potere non è un potere concesso, ed è la stessa regola di
 * `club_permission_active_controls`.
 */
export function controlsFromKeys(
  catalog: PermissionCatalog,
  permissionKeys: readonly string[],
): string[] {
  const keys = new Set(permissionKeys);

  return catalog.areas.flatMap((area) =>
    area.controls
      .filter(
        (control) =>
          control.permissionKeys.length > 0 &&
          control.permissionKeys.every((key) => keys.has(key)),
      )
      .map((control) => control.id),
  );
}

/** Aree con almeno un controllo attivo (§8). */
export function areasEnabled(
  catalog: PermissionCatalog,
  controlIds: readonly string[],
): number {
  const active = new Set(controlIds);

  return catalog.areas.filter((area) =>
    area.controls.some((control) => active.has(control.id)),
  ).length;
}

/**
 * Un'area è configurabile solo se **tutti** i suoi controlli di lettura sono
 * concedibili (§6).
 *
 * «Se Gestisci non è assegnabile, non offrirlo come opzione valida»: il
 * livello si offre quando ogni controllo che lo compone è concedibile, e
 * l'area intera sparisce dall'editor quando nemmeno Visualizza lo è —
 * mostrarla con la sola opzione Nessun accesso sarebbe una riga che non fa
 * nulla.
 */
export function levelIsGrantable(
  area: PermissionArea,
  level: Exclude<AreaLevel, "custom">,
): boolean {
  const ids = new Set(bundleControls(area, level));

  return area.controls
    .filter((control) => ids.has(control.id))
    .every((control) => control.isGrantable);
}

export function areaIsConfigurable(area: PermissionArea): boolean {
  return area.controls.length > 0 && levelIsGrantable(area, "view");
}

export const AREA_LEVEL_LABEL: Record<AreaLevel, string> = {
  custom: "Personalizzato",
  manage: "Gestisci",
  none: "Nessun accesso",
  view: "Visualizza",
};

export const AREA_LEVEL_DESCRIPTION: Record<
  Exclude<AreaLevel, "custom">,
  string
> = {
  manage: "Può utilizzare le normali funzioni di gestione.",
  none: "Non può accedere a questa area.",
  view: "Può consultare senza modificare.",
};

/**
 * Differenze fra due configurazioni, in parole umane (§10).
 *
 * «Per una configurazione granulare usa descrizioni umane delle variazioni,
 * evitando ID tecnici. Non basta "Permessi cambiati" se l'impatto non è
 * comprensibile.»
 */
export function describeChanges(
  catalog: PermissionCatalog,
  before: readonly string[],
  after: readonly string[],
): AreaLevelChange[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const changes: AreaLevelChange[] = [];

  for (const area of catalog.areas) {
    const previous = areaLevel(area, before);
    const next = areaLevel(area, after);

    const details = area.controls
      .filter(
        (control) => beforeSet.has(control.id) !== afterSet.has(control.id),
      )
      .map(
        (control) =>
          `${afterSet.has(control.id) ? "Aggiunto" : "Rimosso"}: ${control.label}`,
      );

    if (previous === next && details.length === 0) {
      continue;
    }

    changes.push({
      areaId: area.id,
      areaLabel: area.label,
      /* Il dettaglio serve quando il livello non lo racconta: da Gestisci a
         Gestisci non è un cambiamento, da Personalizzato a Personalizzato
         sì. */
      details: previous === next || next === "custom" ? details : [],
      next,
      previous,
    });
  }

  return changes;
}

export function findArea(
  catalog: PermissionCatalog | null,
  areaId: string | null,
): PermissionArea | null {
  if (!catalog || !areaId) {
    return null;
  }

  return catalog.areas.find((area) => area.id === areaId) ?? null;
}

export function controlLabel(
  area: PermissionArea,
  controlId: string,
): string | null {
  return (
    area.controls.find((control) => control.id === controlId)?.label ?? null
  );
}

export type { PermissionControl };
