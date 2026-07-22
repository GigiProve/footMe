import { useEffect, useState } from "react";

import { fetchPlayerRepresentations } from "./agent-representation-service";
import { RepresentationSection } from "./RepresentationSection";

type PlayerRepresentationsCardProps = {
  playerProfileId: string;
};

/**
 * Self-fetching wrapper that surfaces a player's accepted representations on
 * their own profile, giving them a persistent area to manage each link.
 * Renders nothing when the player has no representations.
 */
export function PlayerRepresentationsCard({
  playerProfileId,
}: PlayerRepresentationsCardProps) {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof fetchPlayerRepresentations>>
  >([]);

  useEffect(() => {
    let active = true;

    fetchPlayerRepresentations(playerProfileId)
      .then((data) => {
        if (active) {
          setRows(data);
        }
      })
      .catch(() => {
        if (active) {
          setRows([]);
        }
      });

    return () => {
      active = false;
    };
  }, [playerProfileId]);

  return <RepresentationSection isOwner representations={rows} />;
}
