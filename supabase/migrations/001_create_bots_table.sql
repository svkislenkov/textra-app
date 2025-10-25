-- Create bots table
CREATE TABLE IF NOT EXISTS public.bots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  message TEXT NOT NULL,
  frequency TEXT NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own bots
CREATE POLICY "Users can view their own bots"
  ON public.bots
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own bots
CREATE POLICY "Users can create their own bots"
  ON public.bots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own bots
CREATE POLICY "Users can update their own bots"
  ON public.bots
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own bots
CREATE POLICY "Users can delete their own bots"
  ON public.bots
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS bots_user_id_idx ON public.bots(user_id);
