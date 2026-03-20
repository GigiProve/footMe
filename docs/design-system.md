# FootMe Design System

> Single source of truth for all UI tokens, components, and patterns in the FootMe mobile app.

## Philosophy

FootMe's interface follows a **LinkedIn-like** design philosophy adapted for amateur football:

- **Clean but warm** — professional without being cold
- **Dense but readable** — information-rich without visual noise
- **Card-based** — every content group lives inside a consistent card surface
- **Profile-first** — scouting, identity, and role always visible at a glance
- **Mobile-first** — every interaction is designed for touch on small screens

### Hierarchy Principles

1. One primary action per view
2. Content before controls
3. Readonly mode privileged, edit mode separated
4. Sections are vertically stacked and visually grouped
5. Status expressed with badges / chips, never plain text

---

## Design Tokens

All tokens live in `apps/mobile/src/styles/tokens/` and are re-exported via `src/theme/tokens.ts`.

### Colors (`colors.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#F4F8FB` | App background |
| `backgroundStrong` | `#E7F0F8` | Cover areas, section backgrounds |
| `surface` | `#FFFFFF` | Cards, sheets, modals |
| `surfaceMuted` | `#EEF3F8` | Disabled surfaces, placeholders |
| `textPrimary` | `#1D2226` | Headings, body text |
| `textSecondary` | `#5E6E7E` | Descriptions, metadata |
| `textMuted` | `#7A8896` | Hints, timestamps |
| `accent` | `#0A66C2` | Primary buttons, links |
| `accentStrong` | `#004182` | Active states, hero elements |
| `accentSoft` | `#E8F3FF` | Accent backgrounds, chip fills |
| `danger` | `#B42318` | Destructive actions |
| `dangerSoft` | `#FEE4E2` | Danger backgrounds |
| `success` | `#027A48` | Positive states |
| `successSoft` | `#D1FADF` | Success backgrounds |
| `warning` | `#B54708` | Warning states |
| `warningSoft` | `#FEF0C7` | Warning backgrounds |
| `border` | `#D6E1EB` | Dividers, card borders |
| `transparent` | `transparent` | Utility value |

### Typography (`typography.ts` + `textPresets.ts`)

#### Raw Scale

| Token | Size |
|-------|------|
| `fontSize[12]` | 12px — captions, meta |
| `fontSize[14]` | 14px — small body |
| `fontSize[16]` | 16px — body |
| `fontSize[17]` | 17px — titles |
| `fontSize[18]` | 18px — sub-headings |
| `fontSize[20]` | 20px — card headings (h3) |
| `fontSize[24]` | 24px — section headings (h2) |
| `fontSize[28]` | 28px — page headings (h1) |
| `fontSize[34]` | 34px — hero displays |

#### Semantic Presets (via `textPresets`)

| Preset | Size | Weight | Color | Usage |
|--------|------|--------|-------|-------|
| `display` | 34 | 800 | textPrimary | Onboarding hero, splash |
| `h1` | 28 | 800 | textPrimary | Page titles |
| `h2` | 24 | 800 | textPrimary | Section titles |
| `h3` | 20 | 700 | textPrimary | Card titles |
| `title` | 17 | 700 | textPrimary | List names, field groups |
| `body` | 16 | 400 | textPrimary | Default body copy |
| `bodySmall` | 14 | 400 | textSecondary | Metadata, descriptions |
| `caption` | 12 | 700 | textSecondary | Labels, timestamps |
| `meta` | 12 | 700 | textMuted | Uppercase field hints |

### Spacing (`spacing.ts`)

Scale: 0, 2, 4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48, 56, 64

- **Screen padding**: `spacing[20]` horizontal, `spacing[24]` vertical
- **Section gap**: `spacing[12]`
- **Card internal gap**: `spacing[12]` – `spacing[14]`
- **Field gap**: `spacing[8]`

### Border Radius (`radius.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| `4`–`12` | 4–12px | Small elements, inputs |
| `14`–`16` | 14–16px | Buttons, badges |
| `18`–`24` | 18–24px | Cards, sections |
| `full` | 999px | Chips, avatars |

### Shadows (`shadows.ts`)

| Token | Elevation | Usage |
|-------|-----------|-------|
| `sm` | 1 | Subtle lift (inputs, dividers) |
| `card` | 3 | Card elevation |
| `lg` | 6 | Modals, floating elements |

### Sizes (`sizes.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| `touchTarget` | 44px | Minimum tap area |
| `avatarSm` | 32px | Inline avatars (list items) |
| `avatarMd` | 48px | Medium avatars (cards) |
| `avatarLg` | 72px | Large avatars (profiles) |
| `avatarXl` | 104px | Profile header avatar |
| `iconSm`–`iconXl` | 16–32px | Icon size scale |

### Opacity (`opacity.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| `disabled` | 0.56 | Disabled controls |
| `loading` | 0.74 | Loading state |
| `pressed` | 0.88 | Pressed state |
| `muted` | 0.6 | De-emphasized elements |

### Borders (`borders.ts`)

| Token | Value |
|-------|-------|
| `thin` | 1px |
| `medium` | 2px |
| `thick` | 4px |

---

## Primitive Components (Level 1)

All primitives are in `apps/mobile/src/ui/` and exported from `src/ui/index.ts`.

### AppText

Typed text primitive — every visible text in FootMe should use `AppText`.

```tsx
<AppText preset="h1">Section Title</AppText>
<AppText preset="body" color="textSecondary">Description</AppText>
<AppText preset="meta">FIELD LABEL</AppText>
```

**Props**: `preset`, `color`, `align`, `numberOfLines`, `style`, `testID`

### Button

Multi-variant button with loading state and icon support.

**Variants**: `primary`, `secondary`, `tertiary`, `danger`, `link`, `icon`, `chipAction`
**Sizes**: `sm` (44px), `md` (48px), `lg` (52px)

### Card

Surface container with border and optional elevation.

**Variants**: `default`, `muted`, `inverse`

### Input

Text input with label, focus states, and keyboard-aware scrolling.

### Badge

Status badge with multiple color variants.

### AppAvatar

Circular or rounded-square avatar with fallback icon.

```tsx
<AppAvatar imageUrl={player.avatarUrl} size="lg" />
<AppAvatar imageUrl={club.logoUrl} size="md" rounded />
```

**Sizes**: `sm` (32px), `md` (48px), `lg` (72px), `xl` (104px)

### AppChip

Compact tag / filter element.

```tsx
<AppChip label="Attaccante" variant="accent" />
<AppChip label="Under 21" onPress={toggle} variant={active ? "selected" : "default"} />
```

**Variants**: `default`, `selected`, `accent`, `muted`

### AppSection

LinkedIn-style section card with title, optional description, divider, and content.

```tsx
<AppSection title="Esperienze" description="Le tue esperienze calcistiche">
  <ExperienceCard … />
</AppSection>
```

### AppDivider

Horizontal 1px separator line with optional vertical spacing.

```tsx
<AppDivider />
<AppDivider spacing={16} />
```

### AppEmptyState

Standardised empty-state placeholder with icon, title, description, and action.

```tsx
<AppEmptyState
  icon="football-outline"
  title="Nessuna esperienza"
  description="Aggiungi la tua prima esperienza calcistica."
  action={<Button label="Aggiungi" onPress={…} />}
/>
```

### AppLoader

Centered loading indicator with optional label.

```tsx
<AppLoader label="Caricamento profilo…" />
```

### AppListItem

Generic list row with optional leading / trailing accessories.

```tsx
<AppListItem
  leading={<AppAvatar imageUrl={url} size="sm" />}
  trailing={<Icon name="chevron-forward" />}
  onPress={goToProfile}
>
  <AppText preset="title">Mario Rossi</AppText>
  <AppText preset="bodySmall">Centrocampista • AS Roma</AppText>
</AppListItem>
```

### Icon / IconButton

Ionicons-based icon system for tab bar and inline actions.

---

## Product Components (Level 2)

Built on top of primitives, these live in `src/features/*/components/` or `src/components/ui/`.

| Component | Location | Description |
|-----------|----------|-------------|
| `ProfileHeader` | `features/profiles/` | Cover + avatar + name + badges |
| `ProfileSection` | `features/profiles/` | Card wrapper for profile sections |
| `ProfileField` | `features/profiles/` | Readonly/editable field with label |
| `BioSection` | `features/profiles/` | Bio display/edit section |
| `ContactSection` | `features/profiles/` | Contact info with visibility controls |
| `PersonalInfoSection` | `features/profiles/` | Personal data fields |
| `PlayerSportsSection` | `features/profiles/` | Sports stats and position |
| `FootballPositionPicker` | `features/profiles/` | Visual position picker |
| `ClubSeasonSection` | `features/profiles/` | Club season history |
| `StatusBadge` | `features/admin/` | Verification status indicator |
| `ClubRegistrationRequestCard` | `features/admin/` | Admin club request card |
| `MediaPickerField` | `components/ui/` | Image/video picker |
| `WheelPicker` | `components/ui/` | Scrollable value picker |
| `DatePickerField` | `components/ui/` | Date input with picker |

---

## Screen Inventory

| Screen | Route | Status |
|--------|-------|--------|
| Sign In | `(auth)/sign-in` | ✅ Uses tokens |
| Sign Up | `(auth)/sign-up` | ✅ Uses tokens |
| Onboarding Profile | `(onboarding)/profile` | ⚠️ Heavy inline styles |
| Player/Club Profile | `(tabs)/profile` | ✅ Uses profile components |
| Home Feed | `(tabs)/index` | ✅ Uses tokens |
| Network | `(tabs)/network` | ⚠️ Needs AppText/AppSection |
| Messages | `(tabs)/messages` | ⚠️ Needs AppText |
| Announcements | `(tabs)/announcements` | ⚠️ Needs AppText |
| Admin Dashboard | `(admin)/dashboard` | ⚠️ Uses plain objects |
| Club Detail | `club/[id]` | ⚠️ Needs AppText/AppSection |
| Settings | `settings` | ⚠️ Needs AppListItem |

---

## Figma-Ready Screen Targets

Priority screens for Figma reconstruction:

1. **Player Profile** — hero header, badges, sections, readonly fields
2. **Club Profile** — logo avatar, season history, contact card
3. **Sign In** — eyebrow + hero title + form card + social divider
4. **Onboarding (role selection)** — card grid with emoji + description
5. **Admin Dashboard** — list + status badges + stats
6. **Network / Search** — filter chips + list items with avatars
7. **Chat Conversation** — message bubbles + composer

For each screen, the design tokens and component inventory in this document provide the exact specifications needed to reproduce in Figma.

---

## File Structure

```
apps/mobile/src/
├── styles/
│   └── tokens/
│       ├── borders.ts
│       ├── colors.ts
│       ├── opacity.ts
│       ├── radius.ts
│       ├── shadows.ts
│       ├── sizes.ts
│       ├── spacing.ts
│       ├── textPresets.ts
│       ├── typography.ts
│       ├── zIndex.ts
│       └── index.ts
├── theme/
│   └── tokens.ts           (re-exports from styles/tokens)
├── ui/
│   ├── Avatar/AppAvatar.tsx
│   ├── Badge/Badge.tsx
│   ├── Button/Button.tsx
│   ├── Button/IconButton.tsx
│   ├── Card/Card.tsx
│   ├── Chip/AppChip.tsx
│   ├── Divider/AppDivider.tsx
│   ├── EmptyState/AppEmptyState.tsx
│   ├── icons/Icon.tsx
│   ├── Input/Input.tsx
│   ├── ListItem/AppListItem.tsx
│   ├── Loader/AppLoader.tsx
│   ├── Section/AppSection.tsx
│   ├── Text/AppText.tsx
│   └── index.ts
├── components/ui/           (form-level components)
└── features/                (product components)
```

---

## Refactor Priority

1. ✅ Design tokens (enhanced)
2. ✅ Primitive UI components
3. ✅ Profile screen components (using primitives)
4. ✅ Admin components (using primitives)
5. ⬜ Onboarding screens (replace inline styles)
6. ⬜ Navigation & tab bar cleanup
7. ⬜ Remaining screen migrations
8. ⬜ Media UX unification

---

## Next Steps

- Migrate remaining inline-style-heavy screens (onboarding, network, messages) to use `AppText`, `AppSection`, `AppChip`
- Add `AppTextarea` primitive for multiline input areas
- Add `StatsRow` product component for player statistics
- Add `MediaCard` product component for highlight videos
- Create Figma component library mirroring this token/component system
- Add dark mode token layer
