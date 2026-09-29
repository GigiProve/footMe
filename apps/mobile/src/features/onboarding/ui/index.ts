/**
 * Master UI onboarding ProLink (REV-ONB-01).
 *
 * È l'unico linguaggio visuale dell'onboarding: Calciatore, Allenatore, Staff
 * tecnico, Società, Procuratore, Dirigente e Media/appassionati importano da
 * qui. Le task REV-ONB successive aggiungono contenuti e logiche di ruolo,
 * non nuovi header, CTA, campi o selector.
 */

export { OnboardingPage } from "./OnboardingPage";
export { OnboardingHeader } from "./OnboardingHeader";
export { OnboardingProgress } from "./OnboardingProgress";
export { OnboardingFooter } from "./OnboardingFooter";
export { getOnboardingCounter } from "./onboarding-counter";
export { OnboardingSection } from "./OnboardingSection";
export { FieldShell } from "./FieldShell";
export { OnboardingTextField } from "./OnboardingTextField";
export { OnboardingSelectField } from "./OnboardingSelectField";
export { PhoneField } from "./PhoneField";
export { CityAutocompleteField } from "./CityAutocompleteField";
export {
  OnboardingMultiSelectField,
  buildSelectionSummary,
} from "./OnboardingMultiSelectField";
export { OnboardingChipMultiSelect } from "./OnboardingChipMultiSelect";
export {
  BottomSheetSelector,
  type SelectorOption,
} from "./BottomSheetSelector";
export { SegmentedSelector } from "./SegmentedSelector";
export { SelectionRow } from "./SelectionRow";
export { ToggleRow, ToggleSwitch } from "./ToggleRow";
export { RoleCard } from "./RoleCard";
export { PhotoPicker, PhotoTips } from "./PhotoPicker";
export {
  NumericStepperInput,
  normalizeStepperInput,
} from "./NumericStepperInput";
export { DateSelector } from "./DateSelector";
export { PeriodField } from "./PeriodField";
export {
  buildDateSelectorValue,
  buildSeasonOptions,
  buildYearOptions,
  formatDateSelectorValue,
  parseDateSelectorValue,
  MONTH_NAMES,
  type DateSelectorMode,
} from "./date-selector-utils";
export { ExperienceSummaryCard } from "./ExperienceSummaryCard";
export { OnboardingEmptyState } from "./OnboardingEmptyState";
export { OnboardingCompletion } from "./OnboardingCompletion";
export { InfoMessage } from "./InfoMessage";
export { InlineError } from "./InlineError";
export { useReduceMotion } from "./use-reduce-motion";
export {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingMotion,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";
