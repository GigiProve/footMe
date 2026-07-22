const iconNames = {
  announcements: {
    active: "megaphone",
    inactive: "megaphone-outline",
  },
  home: {
    active: "home",
    inactive: "home-outline",
  },
  messages: {
    active: "chatbubble-ellipses",
    inactive: "chatbubble-ellipses-outline",
  },
  network: {
    active: "people",
    inactive: "people-outline",
  },
  profile: {
    active: "person-circle",
    inactive: "person-circle-outline",
  },
  search: {
    active: "search",
    inactive: "search-outline",
  },
  dashboard: {
    active: "grid",
    inactive: "grid-outline",
  },
} as const;

export type IconName = keyof typeof iconNames;

export function resolveIconName(name: IconName, active = false) {
  return active ? iconNames[name].active : iconNames[name].inactive;
}
