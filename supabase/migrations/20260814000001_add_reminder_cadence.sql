-- Extend user_reminders with a recurring cadence so reminders RESCHEDULE
-- after each send instead of being one-shot. Existing rows (created before
-- this migration) backfill to 'weekly' via the column DEFAULT.
-- Does NOT recreate the table — user_reminders already exists.

ALTER TABLE public.user_reminders
  ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'weekly';

-- Keep the allowed cadences constrained (mirrors REMINDER_CADENCES in
-- lib/reminders/reminder-engine.ts). Guard with a DO block so re-running
-- this migration is safe if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_reminders_cadence_check'
  ) THEN
    ALTER TABLE public.user_reminders
      ADD CONSTRAINT user_reminders_cadence_check
      CHECK (cadence IN ('daily', 'weekly', 'monthly'));
  END IF;
END $$;
