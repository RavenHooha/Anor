-- Add 'child_safety' as a distinct report reason so users can flag
-- minors / CSAE concerns specifically, rather than bundling them under
-- the generic 'safety' category. Required for Play Store's Child Safety
-- Standards declaration ("app provides an explicit way to report child
-- safety concerns in-app").

alter table reports drop constraint reports_reason_check;

alter table reports add constraint reports_reason_check check (reason in (
  'inappropriate_content',
  'harassment',
  'child_safety',
  'spam',
  'fake_profile',
  'safety',
  'other'
));
