// Connection preferences: opt-in "how to connect with me" signals shown
// on a profile. They take the guesswork out of first contact — useful to
// everyone (shy, anxious, new in town), and especially to neurodivergent
// users who'd rather not decode ambiguous social cues. Universal design:
// see project memory project-nd-accommodation.
//
// Stored as plain text (see migration 0029), validated here. Phrased in
// the first person so they read naturally on someone's profile.
export const CONNECT_PREF_OPTIONS = [
  'Text first',
  'Be direct with me',
  'Skip the small talk',
  "I'm slow to reply",
  'OK to say hi in person',
  'Ask before calling',
  'One thing at a time',
  'I take things literally',
] as const;

export const MAX_CONNECT_PREFS = 4;
