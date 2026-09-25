// Builds a wa.me deep link with a pre-written message. Tapping it opens
// WhatsApp with the message drafted in the compose box — nothing is ever
// sent automatically, the organizer still has to hit send themselves.
export function buildNudgeMessage(tripName: string, shareUrl: string, participantName: string): string {
  return `Hey ${participantName}! Quick one — can you fill in your preferences for "${tripName}" so we can lock in the trip? ${shareUrl}`;
}

export function buildNudgeWhatsAppLink(tripName: string, shareUrl: string, participantName: string): string {
  const message = buildNudgeMessage(tripName, shareUrl, participantName);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
