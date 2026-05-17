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

// Placeholder support address. Set up a real inbox (or forward to your
// personal email) before sharing the app with anyone outside your circle.
export const SUPPORT_EMAIL = 'support@anor.app';

export function supportMailto(subject = 'Anor support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
