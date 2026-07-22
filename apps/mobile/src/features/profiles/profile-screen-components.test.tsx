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
          ageLabel="22 anni"
          availabilityBadges={["Sotto contratto", "Disponibile al trasferimento"]}
          avatarUrl=""
          bio="Attaccante dinamico, abituato ad attaccare la profondita'."
          categoryBadges={["Serie D", "Eccellenza"]}
          clubLabel="ASD Esempio · Eccellenza"
          fullName="Marco Rossi"
          heightLabel="185 cm"
          locationLabel="Milano, Lombardia"
          mode="owner"
          onAddContentPress={() => undefined}
          onEditProfilePress={() => undefined}
          preferredFootLabel="Destro"
          primaryRole="Attaccante"
          regionBadges={["Lombardia", "Veneto"]}
          secondaryRole="Seconda punta"
          statusBadge="Disponibile al trasferimento"
          weightLabel="78 kg"
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Attaccante" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Seconda punta" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Disponibilita'" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Categorie" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Zone" })).toBeTruthy();
  });

  it("renders the shared player header in visitor mode with visitor actions only", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerProfileHeader
          ageLabel="22 anni"
          availabilityBadges={["Svincolato"]}
          avatarUrl={null}
          fullName="Marco Rossi"
          heightLabel="Da definire"
          mode="visitor"
          onContactPress={() => undefined}
          onFollowPress={() => undefined}
          preferredFootLabel="Da definire"
          primaryRole="Attaccante"
          weightLabel="Da definire"
        />,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Segui" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Contatta" })).toBeTruthy();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Inserisci contenuti" })).toThrow();
  });

  it("keeps the player header stable when optional data is missing", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerProfileHeader
          ageLabel="Da definire"
          avatarUrl={null}
          fullName="Marco Rossi"
          heightLabel="Da definire"
          mode="visitor"
          preferredFootLabel="Da definire"
          primaryRole="Attaccante"
          weightLabel="Da definire"
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Attaccante" })).toBeTruthy();
    expect(tree!.root.findAllByProps({ children: "Da definire" }).length).toBeGreaterThan(0);
  });

  it("renders the shared coach header in owner mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachProfileHeader
          assignmentLabel="Allenatore Prima Squadra · AC Como"
          availabilityBadges={["Lombardia", "Piemonte"]}
          avatarUrl=""
          bio="Allenatore focalizzato su intensità e organizzazione."
          categoryLocationLabel="Serie D · Milano, Lombardia"
          fullName="Marco Rossi"
          licenseBadges={["UEFA A"]}
          licenseYearsLabel="UEFA A · 8 anni di esperienza"
          mode="owner"
          onAddContentPress={() => undefined}
          onEditProfilePress={() => undefined}
          onFollowersPress={() => undefined}
          onFollowingPress={() => undefined}
          onMutualPress={() => undefined}
          primaryRole="Allenatore Prima Squadra"
          profileId="coach-1"
          roleTypeLabel="Allenatore"
          socialSummary={{
            followerCount: 428,
            followingCount: 186,
            mutualPreview: [
              { profileId: "p1", displayName: "Luca Bianchi", avatarUrl: null },
              { profileId: "p2", displayName: "Varese Calcio", avatarUrl: null },
            ],
            mutualTotal: 14,
          }}
          statusBadge="Disponibile"
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Allenatore" })).toBeTruthy();
    expect(
      tree!.root.findByProps({ children: "Allenatore Prima Squadra · AC Como" }),
    ).toBeTruthy();
    expect(
      tree!.root.findByProps({ children: "Serie D · Milano, Lombardia" }),
    ).toBeTruthy();
    expect(
      tree!.root.findByProps({ children: "UEFA A · 8 anni di esperienza" }),
    ).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Disponibile" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Aggiungi contenuto" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica copertina" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica foto profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "428 follower" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "186 seguiti" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Vedi connessioni in comune" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Licenze" })).toBeTruthy();
  });

  it("renders the shared coach header in visitor mode without owner-only controls", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachProfileHeader
          avatarUrl=""
          fullName="Marco Rossi"
          mode="visitor"
          onContactPress={() => undefined}
          onFollowPress={() => undefined}
          primaryRole="Allenatore"
        />,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Segui" })).toBeTruthy();
    expect(tree!.root.findByProps({ accessibilityLabel: "Contatta" })).toBeTruthy();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Aggiungi contenuto" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica copertina" })).toThrow();
    expect(() => tree!.root.findByProps({ accessibilityLabel: "Modifica foto profilo" })).toThrow();
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
          profileId="coach-1"
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(() =>
      tree!.root.findByProps({ accessibilityLabel: "Vedi connessioni in comune" }),
    ).toThrow();
    expect(() => tree!.root.findByProps({ children: "Licenze" })).toThrow();
  });
});
