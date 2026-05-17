// Founding member status — visible badge for users who joined Anor before
// the cutoff date. Pure marketing/loyalty feature; nothing functional gates
// on this.
//
// The cutoff is generous on purpose. We want every Sylva-launch user and
// the first several months of expansion users to qualify. If the company
// ever grows enough that "founding member" becomes meaningless because
// everyone has it, that's a problem we'd love to have.

export const FOUNDING_MEMBER_CUTOFF = new Date('2027-06-30T23:59:59Z');

export function isFoundingMember(createdAtIso: string | null | undefined): boolean {
  if (!createdAtIso) return false;
  const ts = Date.parse(createdAtIso);
  if (Number.isNaN(ts)) return false;
  return ts <= FOUNDING_MEMBER_CUTOFF.getTime();
}
