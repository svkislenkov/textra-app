-- Add notification_ids column to bot_groups table to track scheduled notifications
ALTER TABLE public.bot_groups
ADD COLUMN IF NOT EXISTS notification_ids TEXT[];
