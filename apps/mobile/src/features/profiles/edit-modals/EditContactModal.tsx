import { useEffect, useState } from "react";
import { Alert } from "react-native";

import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { ContactSection } from "../contact-section";
import {
  buildFullUpdatePayload,
  buildInitialState,
} from "../profile-edit-helpers";
import {
  isEmailValid,
  isPhoneNumberValid,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizePhoneInput,
  validateBirthDateInput,
} from "../profile-form-utils";
import { EditModalShell } from "./EditModalShell";

type ContactFormState = {
  contactEmail: string;
  contactFacebook: string;
  contactInstagram: string;
  contactPhone: string;
  showContactEmail: boolean;
  showContactFacebook: boolean;
  showContactInstagram: boolean;
};

type EditContactModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function buildFormState(
  completeProfile: CompleteProfessionalProfile,
): ContactFormState {
  return {
    contactEmail: completeProfile.userContacts.email,
    contactFacebook: completeProfile.userContacts.facebook,
    contactInstagram: completeProfile.userContacts.instagram,
    contactPhone: completeProfile.userContacts.phone,
    showContactEmail: completeProfile.userContacts.showEmail,
    showContactFacebook: completeProfile.userContacts.showFacebook,
    showContactInstagram: completeProfile.userContacts.showInstagram,
  };
}

export function EditContactModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditContactModalProps) {
  const [form, setForm] = useState<ContactFormState>(() =>
    buildFormState(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(buildFormState(completeProfile));
    }
  }, [visible, completeProfile]);

  function handleSave() {
    const normalizedInstagram = normalizeInstagramInput(form.contactInstagram);
    const normalizedFacebook = normalizeFacebookInput(form.contactFacebook);
    const normalizedEmail = normalizeContactEmail(form.contactEmail);
    const normalizedPhone = normalizePhoneInput(form.contactPhone);

    if (form.contactInstagram.trim() && !normalizedInstagram) {
      Alert.alert("Errore", "Inserisci un username o link Instagram valido.");
      return;
    }

    if (form.contactFacebook.trim() && !normalizedFacebook) {
      Alert.alert("Errore", "Inserisci un username o link Facebook valido.");
      return;
    }

    if (normalizedEmail && !isEmailValid(normalizedEmail)) {
      Alert.alert("Errore", "Inserisci un indirizzo email valido.");
      return;
    }

    if (form.contactPhone.trim() && !isPhoneNumberValid(normalizedPhone)) {
      Alert.alert(
        "Errore",
        "Inserisci un numero di telefono valido in formato internazionale E.164.",
      );
      return;
    }

    setIsSaving(true);

    const baseState = buildInitialState(completeProfile);

    const mergedState = {
      ...baseState,
      contactEmail: form.contactEmail,
      contactFacebook: form.contactFacebook,
      contactInstagram: form.contactInstagram,
      contactPhone: form.contactPhone,
      showContactEmail: form.showContactEmail,
      showContactFacebook: form.showContactFacebook,
      showContactInstagram: form.showContactInstagram,
    };

    const payload = buildFullUpdatePayload(completeProfile, mergedState);

    payload.profile.birth_date = validateBirthDateInput(
      baseState.birthDate,
    ).isoValue;

    payload.userContacts = {
      email: normalizedEmail,
      facebook: normalizedFacebook,
      instagram: normalizedInstagram,
      phone: normalizedPhone,
      showEmail: form.showContactEmail,
      showFacebook: form.showContactFacebook,
      showInstagram: form.showContactInstagram,
    };

    updateCompleteProfessionalProfile(payload)
      .then(() => {
        onSaved();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Errore sconosciuto.";
        Alert.alert("Errore", message);
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Contatti"
      visible={visible}
    >
      <ContactSection
        contacts={{
          email: form.contactEmail,
          facebook: form.contactFacebook,
          instagram: form.contactInstagram,
          phone: form.contactPhone,
          showEmail: form.showContactEmail,
          showFacebook: form.showContactFacebook,
          showInstagram: form.showContactInstagram,
        }}
        editable
        onEmailChange={(value) =>
          setForm((prev) => ({ ...prev, contactEmail: value }))
        }
        onFacebookChange={(value) =>
          setForm((prev) => ({ ...prev, contactFacebook: value }))
        }
        onInstagramChange={(value) =>
          setForm((prev) => ({ ...prev, contactInstagram: value }))
        }
        onPhoneChange={(value) =>
          setForm((prev) => ({ ...prev, contactPhone: value }))
        }
        onShowEmailChange={(value) =>
          setForm((prev) => ({ ...prev, showContactEmail: value }))
        }
        onShowFacebookChange={(value) =>
          setForm((prev) => ({ ...prev, showContactFacebook: value }))
        }
        onShowInstagramChange={(value) =>
          setForm((prev) => ({ ...prev, showContactInstagram: value }))
        }
      />
    </EditModalShell>
  );
}
