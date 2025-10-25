-- Add function and type columns to bots table
ALTER TABLE public.bots
ADD COLUMN IF NOT EXISTS function TEXT,
ADD COLUMN IF NOT EXISTS type TEXT;

-- Make message column nullable (for backward compatibility with existing bots)
ALTER TABLE public.bots
ALTER COLUMN message DROP NOT NULL;
