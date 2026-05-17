// Sentry-wrapped Metro config.
//
// `getSentryExpoConfig` returns the standard Expo Metro config and
// additionally wires the bundler to emit + upload sourcemaps to Sentry
// during EAS builds. Sourcemap upload reads these env vars at build time:
//   SENTRY_AUTH_TOKEN (required, secret)
//   SENTRY_ORG        (required, e.g. "ravenhooha")
//   SENTRY_PROJECT    (required, e.g. "anor")
//
// Without sourcemaps uploaded, production crash traces show minified
// frames and are unreadable.

const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
