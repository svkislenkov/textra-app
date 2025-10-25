-- Add day_of_week and day_of_month columns to bots table
ALTER TABLE public.bots
ADD COLUMN IF NOT EXISTS day_of_week TEXT,
ADD COLUMN IF NOT EXISTS day_of_month INTEGER;
