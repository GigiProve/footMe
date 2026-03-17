import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  defaultOnboardingFormState,
  normalizeOnboardingDraft,
  type OnboardingFormState,
  type OnboardingStep,
} from "./onboarding-form";

const ONBOARDING_DRAFT_STORAGE_KEY = "@footme/onboarding-draft/v1";

type OnboardingFormContextValue = {
  form: OnboardingFormState;
  isHydrated: boolean;
  patchForm: (value: Partial<OnboardingFormState>) => void;
  resetForm: () => Promise<void>;
  setCurrentStep: (step: OnboardingStep) => void;
  setFormValue: <Key extends keyof OnboardingFormState>(
    key: Key,
    value: OnboardingFormState[Key],
  ) => void;
};

const OnboardingFormContext = createContext<OnboardingFormContextValue | undefined>(
  undefined,
);

export function OnboardingFormProvider({ children }: PropsWithChildren) {
  const [form, setForm] = useState(defaultOnboardingFormState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateDraft() {
      try {
        const storedValue = await AsyncStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);

        if (!isMounted || !storedValue) {
          return;
        }

        const parsedValue = JSON.parse(storedValue) as unknown;

        if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
          return;
        }

        setForm(normalizeOnboardingDraft(parsedValue));
      } catch (error) {
        console.warn("[onboarding] unable to restore draft", error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    }

    hydrateDraft();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(form)).catch(
      (error) => {
        console.warn("[onboarding] unable to persist draft", error);
      },
    );
  }, [form, isHydrated]);

  const setFormValue = useCallback(
    <Key extends keyof OnboardingFormState>(
      key: Key,
      value: OnboardingFormState[Key],
    ) => {
      setForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const patchForm = useCallback((value: Partial<OnboardingFormState>) => {
    setForm((current) => ({
      ...current,
      ...value,
    }));
  }, []);

  const setCurrentStep = useCallback((step: OnboardingStep) => {
    setForm((current) => ({
      ...current,
      currentStep: step,
    }));
  }, []);

  const resetForm = useCallback(async () => {
    setForm(defaultOnboardingFormState);
    await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      form,
      isHydrated,
      patchForm,
      resetForm,
      setCurrentStep,
      setFormValue,
    }),
    [form, isHydrated, patchForm, resetForm, setCurrentStep, setFormValue],
  );

  return (
    <OnboardingFormContext.Provider value={value}>
      {children}
    </OnboardingFormContext.Provider>
  );
}

export function useOnboardingForm() {
  const context = useContext(OnboardingFormContext);

  if (!context) {
    throw new Error("useOnboardingForm must be used within OnboardingFormProvider");
  }

  return context;
}
