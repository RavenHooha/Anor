import { supabase } from '../lib/supabase';

export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment', description: 'Threats, hate, or repeated unwanted contact' },
  { id: 'inappropriate_content', label: 'Inappropriate content', description: 'Sexual, violent, or graphic material' },
  { id: 'safety', label: 'Safety concern', description: 'I feel unsafe or this person may harm others' },
  { id: 'fake_profile', label: 'Fake profile', description: 'Impersonation, bots, or fake photos' },
  { id: 'spam', label: 'Spam', description: 'Unsolicited messages or scams' },
  { id: 'other', label: 'Other', description: 'Something else worth flagging' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export const REPORT_NOTES_MAX = 500;

export async function reportUser(
  reportedId: string,
  reason: ReportReason,
  contextThreadId: string | null,
  notes: string | null,
): Promise<void> {
  const trimmedNotes = notes && notes.trim().length > 0 ? notes.trim() : null;
  if (trimmedNotes && trimmedNotes.length > REPORT_NOTES_MAX) {
    throw new Error('Notes are too long.');
  }
  const { error } = await supabase.rpc('report_user', {
    reported: reportedId,
    reason,
    context_thread: contextThreadId,
    notes: trimmedNotes,
  });
  if (error) throw error;
}
