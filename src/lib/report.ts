import * as Sentry from '@sentry/react-native';
import { track } from './analytics';

// Single funnel for "something failed quietly and we need field signal."
//
// Before this, background-presence and foreground-push failures only wrote a
// local breadcrumb to AsyncStorage — invisible to a solo founder with no test
// network. This routes the same failure to two places, mirroring the
// `ble_advertise_failed` pattern in src/ble/service.ts:
//   * Sentry — always: a grouped exception with area/op tags for debugging.
//   * PostHog — opt-in only (track() no-ops when the user hasn't opted in): an
//     anonymous event so we can see *rates* in the field. `reason` must be a
//     low-cardinality CATEGORY (e.g. 'auth', 'rpc', 'no_fix') — never a raw
//     error message, which could be high-cardinality or carry identifiers. The
//     full message goes to Sentry's `extra`, which is PII-scrubbed in App.tsx.

type ReportContext = {
  area: string; // subsystem, e.g. 'presence'
  op: string; // operation, e.g. 'bg_checkin'
  reason?: string; // low-cardinality category for the PostHog event
  event?: string; // PostHog event name; omit to skip the analytics ping
  cause?: unknown; // the original error, if there was one
};

export function reportError(message: string, ctx: ReportContext): void {
  const err = ctx.cause instanceof Error ? ctx.cause : new Error(message);
  Sentry.captureException(err, {
    tags: { area: ctx.area, op: ctx.op, ...(ctx.reason ? { reason: ctx.reason } : {}) },
    extra: { message },
  });
  if (ctx.event) {
    const props: Record<string, string> = { area: ctx.area, op: ctx.op };
    if (ctx.reason) props.reason = ctx.reason;
    track(ctx.event, props);
  }
}

/**
 * Anonymous "this ran" counter. Used to measure whether a background task is
 * actually firing in the field (e.g. whether Android OEMs are killing the
 * foreground service) — the denominator for any failure rate. Opt-in only.
 */
export function reportEvent(event: string, props?: Record<string, string>): void {
  track(event, props);
}
