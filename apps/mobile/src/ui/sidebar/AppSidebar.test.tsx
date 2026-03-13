import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./AppSidebar";
import { logout } from "../../features/auth/logout";
import { useSession } from "../../features/auth/use-session";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("../../features/auth/use-session", () => ({
  useSession: vi.fn(),
}));

vi.mock("../../features/auth/logout", () => ({
  logout: vi.fn(),
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        "chatbubble-ellipses-outline": 1,
        "grid-outline": 1,
        "log-out-outline": 1,
        "megaphone-outline": 1,
        "person-outline": 1,
        "settings-outline": 1,
      },
    },
  );

  return {
    default: MockIonicons,
  };
});

function renderSidebar(props: React.ComponentProps<typeof AppSidebar>) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(<AppSidebar {...props} />);
  });

  return tree;
}

describe("AppSidebar", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    vi.mocked(logout).mockReset();
    vi.mocked(useSession).mockReset();
  });

  it("renders the authenticated profile data in the drawer header", () => {
    vi.mocked(useSession).mockReturnValue({
      isLoading: false,
      needsOnboarding: false,
      profile: {
        avatar_url: null,
        city: "Milano",
        club_name: "F.C. Internazionale",
        full_name: "Mario Rossi",
        id: "user-1",
        region: "Lombardia",
        role: "player",
      },
      refreshProfile: vi.fn(),
      session: {
        user: {
          app_metadata: {},
          aud: "authenticated",
          created_at: "2026-03-12T00:00:00.000Z",
          email: "mario@example.com",
          id: "user-1",
          user_metadata: {},
        },
      } as never,
    });

    const tree = renderSidebar({ isOpen: true, onClose: () => undefined });

    expect(tree.root.findByProps({ children: "Mario Rossi" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Calciatore" })).toBeTruthy();
    expect(
      tree.root.findByProps({ children: "F.C. Internazionale · Milano, Lombardia" }),
    ).toBeTruthy();
  });

  it("closes the drawer and routes to the selected destination", () => {
    const onClose = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      isLoading: false,
      needsOnboarding: false,
      profile: {
        avatar_url: null,
        city: null,
        club_name: null,
        full_name: "Mario Rossi",
        id: "user-1",
        region: null,
        role: "player",
      },
      refreshProfile: vi.fn(),
      session: {
        user: {
          app_metadata: {},
          aud: "authenticated",
          created_at: "2026-03-12T00:00:00.000Z",
          email: "mario@example.com",
          id: "user-1",
          user_metadata: {},
        },
      } as never,
    });

    const tree = renderSidebar({ isOpen: true, onClose });
    const profileAction = tree.root.findByProps({ accessibilityLabel: "Apri Profilo" });

    act(() => {
      profileAction.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/(tabs)/profile");
  });

  it("runs logout and redirects to login from the footer action", async () => {
    const onClose = vi.fn();
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(useSession).mockReturnValue({
      isLoading: false,
      needsOnboarding: false,
      profile: {
        avatar_url: null,
        city: null,
        club_name: null,
        full_name: "Mario Rossi",
        id: "user-1",
        region: null,
        role: "player",
      },
      refreshProfile: vi.fn(),
      session: {
        user: {
          app_metadata: {},
          aud: "authenticated",
          created_at: "2026-03-12T00:00:00.000Z",
          email: "mario@example.com",
          id: "user-1",
          user_metadata: {},
        },
      } as never,
    });

    const tree = renderSidebar({ isOpen: true, onClose });
    const logoutAction = tree.root.findByProps({ accessibilityLabel: "Logout" });

    await act(async () => {
      logoutAction.props.onPress();
      await Promise.resolve();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/(auth)/sign-in");
  });
});
