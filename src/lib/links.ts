// Central place for external URLs and the support contact path.
// Update these when you have a real domain + support inbox.

// Until anor.app (or wherever) is live, point at GitHub-rendered markdown.
// GitHub keeps these reachable for anyone with the repo URL; works fine for
// a friends-test. For Play Store / App Store submission, host them on your
// own domain instead — stores want a stable URL you control.
export const TOS_URL =
  'https://github.com/RavenHooha/Anor/blob/main/docs/TOS.md';
export const PRIVACY_POLICY_URL =
  'https://github.com/RavenHooha/Anor/blob/main/docs/PRIVACY_POLICY.md';

// support@meetanor.com is forwarded via Cloudflare Email Routing to the
// founder's personal inbox. To change destination: Cloudflare dashboard
// → meetanor.com → Email → Email Routing → edit the route.
export const SUPPORT_EMAIL = 'support@meetanor.com';

export function supportMailto(subject = 'Anor support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

// Where the "Share Anor" button sends people. Currently points at the
// GitHub repo as a stable, public landing; replace with anor.app/install
// (or wherever you host) once the marketing site exists.
export const INSTALL_URL = 'https://github.com/RavenHooha/Anor';

// Default copy for the share sheet. Keep it short, human, and benefit-led —
// people forward what reads like a real recommendation, not marketing copy.
export const SHARE_MESSAGE =
  "I'm on Anor — it shows you people who are actually nearby right now, " +
  'not just somewhere in the same city. Worth a look: ' +
  INSTALL_URL;
