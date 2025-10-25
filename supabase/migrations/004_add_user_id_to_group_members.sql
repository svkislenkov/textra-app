-- Add user_id column to group_members table (nullable because existing members won't have it)
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON public.group_members(user_id);
