// Confirmation is opt-out, not opt-in: everyone who submitted a response is
// assumed still in for every shortlisted option unless they explicitly say
// otherwise. This is what makes the confirmation round low-friction — with
// N options, staying in costs zero clicks; only opting out costs a click.
export interface ConfirmationRecord {
  participant_id: string;
  confirmed: boolean;
}

export interface RosterMember {
  id: string;
  name: string;
}

export interface ConfirmationSummary {
  stillIn: RosterMember[];
  optedOut: RosterMember[];
}

/** Splits the roster (everyone who submitted a response) into still-in vs. opted-out for one destination. */
export function summarizeDestinationConfirmations(
  roster: RosterMember[],
  confirmationsForDestination: ConfirmationRecord[]
): ConfirmationSummary {
  const optedOutIds = new Set(
    confirmationsForDestination.filter((c) => !c.confirmed).map((c) => c.participant_id)
  );
  return {
    stillIn: roster.filter((p) => !optedOutIds.has(p.id)),
    optedOut: roster.filter((p) => optedOutIds.has(p.id)),
  };
}

/** What this specific participant's status is for one destination — defaults to "in" absent an explicit opt-out. */
export function myEffectiveConfirmation(
  myParticipantId: string | null,
  confirmationsForDestination: ConfirmationRecord[]
): boolean {
  if (!myParticipantId) return true;
  const mine = confirmationsForDestination.find((c) => c.participant_id === myParticipantId);
  return mine ? mine.confirmed : true;
}
