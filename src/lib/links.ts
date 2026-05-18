// Central place for external URLs and the support contact path.
// Update these when you have a real domain + support inbox.

// Served by the anor-site Astro project, deployed to meetanor.com via
// Cloudflare Pages. Source lives in a sibling GitHub repo (anor-site).
export const TOS_URL = 'https://meetanor.com/terms';
export const PRIVACY_POLICY_URL = 'https://meetanor.com/privacy';

// support@meetanor.com is forwarded via Cloudflare Email Routing to the
// founder's personal inbox. To change destination: Cloudflare dashboard
// → meetanor.com → Email → Email Routing → edit the route.
export const SUPPORT_EMAIL = 'support@meetanor.com';

export function supportMailto(subject = 'Anor support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

// Where the "Share Anor" button sends people — the install page on
// the marketing site.
export const INSTALL_URL = 'https://meetanor.com/install';

// Default copy for the share sheet. Keep it short, human, and benefit-led —
// people forward what reads like a real recommendation, not marketing copy.
export const SHARE_MESSAGE =
  "I'm on Anor — it shows you people who are actually nearby right now, " +
  'not just somewhere in the same city. Worth a look: ' +
  INSTALL_URL;
