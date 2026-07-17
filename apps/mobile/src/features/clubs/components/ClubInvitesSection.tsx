import { useState } from "react";

import { Button, SectionCard } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { InviteLinkModal } from "./InviteLinkModal";

export function ClubInvitesSection() {
  const { profile, session } = useSession();
  const clubId = profile?.club_id ?? null;
  const createdBy = session?.user?.id ?? null;
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);

  return (
    <>
      <SectionCard
        description="Genera e condividi link per far registrare giocatori e staff"
        title="Link di invito"
      >
        <Button
          label="Genera link invito"
          onPress={() => setInviteModalOpen(true)}
          variant="primary"
        />
      </SectionCard>

      <InviteLinkModal
        clubId={clubId ?? ""}
        createdBy={createdBy ?? ""}
        onClose={() => setInviteModalOpen(false)}
        visible={isInviteModalOpen}
      />
    </>
  );
}
