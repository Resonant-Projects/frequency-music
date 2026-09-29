// One predicate for "a human listened". Debt closure, recommendations,
// verdict selection, failure analysis, and fitness must all use it.
export type ListeningSessionLike = {
  createdBy: string;
  participants: { role?: string }[];
};

export function isHumanListeningSession(
  session: ListeningSessionLike,
): boolean {
  if (session.createdBy === "system") return false;
  return !session.participants.some(
    (participant) => participant.role === "machine",
  );
}
