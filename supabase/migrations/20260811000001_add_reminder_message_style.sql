-- Extend user_reminders with a message style so members can choose how
-- Coach Cass AI phrases the check-in when the reminder fires.
-- Does NOT recreate the table — user_reminders already exists.

ALTER TABLE public.user_reminders
  ADD COLUMN IF NOT EXISTS message_style TEXT NOT NULL DEFAULT 'gentle';

-- Keep the allowed styles constrained (mirrors the templates in
-- lib/reminders/reminder-engine.ts). Guard with a DO block so re-running
-- this migration is safe if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_reminders_message_style_check'
  ) THEN
    ALTER TABLE public.user_reminders
      ADD CONSTRAINT user_reminders_message_style_check
      CHECK (message_style IN ('gentle', 'direct', 'hype'));
  END IF;
END $$;
