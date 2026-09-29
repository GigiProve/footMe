import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  CoachProfileHeader,
  PlayerProfileHeader,
  ProfileField,
  ProfileHeader,
  ProfileSection,
} from "./profile-screen-components";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("./media-upload-service", () => ({
  captureAndUploadPhoto: vi.fn(),
  pickAndUploadMedia: vi.fn(),
  removeMediaFromStorage: vi.fn(),
}));

vi.mock("./profile-social-service", () => ({
  updateProfileAvatarUrl: vi.fn(),
  updateProfileCoverUrl: vi.fn(),
}));

const OWNER_QUICK_FACTS = [
  { accessibilityLabel: "Età, 22 anni", key: "age", label: "Età", value: "22" },
  {
    accessibilityLabel: "Altezza, 185 centimetri",
    key: "height",
    label: "Altezza",
    unit: "cm",
    value: "185",
  },
  {
    accessibilityLabel: "Peso, 78 chilogrammi",
    key: "weight",
    label: "Peso",
    unit: "kg",
    value: "78",
  },
  { accessibilityLabel: "Piede, destro", key: "foot", label: "Piede", value: "Destro" },
] as const;

const MISSING_QUICK_FACTS = [
  { accessibilityLabel: "Età non indicata", key: "age", label: "Età", value: "—" },
  {
    accessibilityLabel: "Altezza non indicata",
    key: "height",
    label: "Altezza",
    value: "—",
  },
  { accessibilityLabel: "Peso non indicato", key: "weight", label: "Peso", value: "—" },
  { accessibilityLabel: "Piede non indicato", key: "foot", label: "Piede", value: "—" },
] as const;

/** Le quattro colonne dell'Allenatore (REV-PROF-03). */
const COACH_QUICK_FACTS = [
  { accessibilityLabel: "Eta, 31 anni", key: "age", label: "Eta", value: "31" },
  {
    accessibilityLabel: "Patentino, UEFA B",
    key: "license",
    label: "Patentino",
    value: "UEFA B",
  },
  { accessibilityLabel: "Stagioni, 8", key: "seasons", label: "Stagioni", value: "8" },
  {
    accessibilityLabel: "Modulo, 4-3-3",
    key: "formation",
    label: "Modulo",
    value: "4-3-3",
  },
] as const;

describe("profile-screen-components", () => {
  it("renders readonly profile fields with a fallback value", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<ProfileField label="Telefono" value="" />);
    });

    expect(tree!.root.findByProps({ children: "Telefono" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Da completare" })).toBeTruthy();
  });

  it("renders editable profile fields with the input value", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ProfileField
          editable
          label="Nome"
          onChangeText={() => undefined}
          value="Mario Rossi"
        />,
      );
    });

    const input = tree!.root.findByType("TextInput" as never);
    expect(input.props.value).toBe("Mario Rossi");
  });

  it("renders section metadata and header action labels", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <>
          <ProfileHeader
            avatarUrl=""
            badges={["Calciatore"]}
            fullName="Mario Rossi"
            onEditPress={() => undefined}
            primaryMeta="Juventus U17 · Attaccante"
            secondaryMeta="Capitano"
          />
          <ProfileSection description="Dati principali del profilo" title="Informazioni personali">
            <ProfileField label="Nome" value="Mario Rossi" />
          </ProfileSection>
        </>,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Informazioni personali" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Dati principali del profilo" })).toBeTruthy();
  });

  it("renders the shared player header in owner mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerProfileHeader
          availabilityLabel="Disponibile al trasferimento · Sotto contratto"
          avatarUrl=""
          clubLabel="ASD Esempio · Eccellenza"
          fullName="Marco Rossi"
          locationLabel="Milano, Lombardia"
          mode="owner"
          onEditProfilePress={() => undefined}
          primaryRole="Attaccante"
          quickFacts={OWNER_QUICK_FACTS}
          secondaryRole="Seconda punta"
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Attaccante" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Seconda punta" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toBeTruthy();
    // §6: l'Owner non vede azioni da Visitor verso sé stesso.
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Segui" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Contatta" })).toThrow();
  });

  // §9: le informazioni rapide non hanno icone e l'unità resta separata dal
  // numero, così il valore può usare il peso Mulish senza trascinarsi "cm".
  it("renders quick facts without icons and with units", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerProfileHeader
          avatarUrl={null}
          fullName="Marco Rossi"
          mode="owner"
          primaryRole="Attaccante"
          quickFacts={OWNER_QUICK_FACTS}
        />,
      );
    });

    expect(
      tree!.root.findByProps({ accessibilityLabel: "Altezza, 185 centimetri" }),
    ).toBeTruthy();
    expect(tree!.root.findByProps({ children: "185" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "cm" })).toBeTruthy();
  });

  it("renders the shared player header in visitor mode with visitor actions only", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerProfileHeader
          avatarUrl={null}
          fullName="Marco Rossi"
          mode="visitor"
          onContactPress={() => undefined}
          onFollowPress={() => undefined}
          primaryRole="Attaccante"
          quickFacts={OWNER_QUICK_FACTS}
        />,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Segui" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Contatta" })).toBeTruthy();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Inserisci contenuti" })).toThrow();
  });

  // §7: senza ruolo secondario non resta un separatore orfano né una
  // ripetizione del ruolo principale.
  it("keeps the player header stable when optional data is missing", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerProfileHeader
          avatarUrl={null}
          fullName="Marco Rossi"
          mode="visitor"
          primaryRole="Attaccante"
          quickFacts={MISSING_QUICK_FACTS}
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree!.root.findAllByProps({ children: "Attaccante" }).length).toBeGreaterThan(0);
    expect(() => tree!.root.findByProps({ children: "·" })).toThrow();
    expect(tree!.root.findAllByProps({ children: "—" }).length).toBeGreaterThan(0);
  });

  it("renders the coach master header in owner mode with the owner action bar", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachProfileHeader
          availabilityLabel="Disponibile per una nuova squadra"
          avatarUrl=""
          clubLabel="Torino FC · Prima Squadra"
          fullName="Marco Rossi"
          isVerified
          locationLabel="Torino, Piemonte"
          mode="owner"
          onEditProfilePress={() => undefined}
          onMorePress={() => undefined}
          onSharePress={() => undefined}
          primaryRole="Allenatore"
          quickFacts={COACH_QUICK_FACTS}
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Allenatore" })).toBeTruthy();
    expect(
      tree!.root.findByProps({ children: "Torino FC · Prima Squadra" }),
    ).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Torino, Piemonte" })).toBeTruthy();
    expect(
      tree!.root.findByProps({ children: "Disponibile per una nuova squadra" }),
    ).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Profilo verificato" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Condividi profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Altre azioni" })).toBeTruthy();
    // Le quattro informazioni rapide della task, non le vecchie Licenze.
    expect(tree!.root.findByProps({ children: "Patentino" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Stagioni" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Modulo" })).toBeTruthy();
    expect(() => tree!.root.findByProps({ children: "Licenze" })).toThrow();
  });

  it("renders the coach master header in visitor mode with Segui and Messaggio", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachProfileHeader
          avatarUrl=""
          fullName="Marco Rossi"
          mode="visitor"
          onFollowPress={() => undefined}
          onMessagePress={() => undefined}
          onSharePress={() => undefined}
          primaryRole="Allenatore"
        />,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Segui" })).toBeTruthy();
    // "Contatta" non esiste piu': la stessa azione ha un nome solo.
    expect(tree!.root.findByProps({ accessibilityLabel: "Messaggio" })).toBeTruthy();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Contatta" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica copertina" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica foto profilo" })).toThrow();
  });

  it("shows the followed state instead of a second Segui action", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachProfileHeader
          avatarUrl=""
          fullName="Marco Rossi"
          isFollowed
          mode="visitor"
          onFollowPress={() => undefined}
          onMessagePress={() => undefined}
          primaryRole="Allenatore"
        />,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Seguito" })).toBeTruthy();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Segui" })).toThrow();
  });

  it("hides coach header rows that have no reliable data instead of showing empty placeholders", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachProfileHeader
          avatarUrl=""
          fullName="Marco Rossi"
          mode="owner"
          onEditProfilePress={() => undefined}
          primaryRole="Allenatore"
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    // Nessun badge di verifica su un profilo che non e' verificato.
    expect(() =>
      tree!.root.findByProps({ accessibilityLabel: "Profilo verificato" }),
    ).toThrow();
    expect(() => tree!.root.findByProps({ children: "Licenze" })).toThrow();
  });
});
