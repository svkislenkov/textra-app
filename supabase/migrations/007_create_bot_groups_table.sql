-- Create bot_groups junction table to link bots to groups
CREATE TABLE IF NOT EXISTS public.bot_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  current_member_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bot_id, group_id)
);

-- Enable Row Level Security
ALTER TABLE public.bot_groups ENABLE ROW LEVEL SECURITY;

-- Users can view bot_groups if they own the bot
CREATE POLICY "Users can view their own bot_groups"
  ON public.bot_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = bot_groups.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Users can insert bot_groups if they own the bot
CREATE POLICY "Users can insert their own bot_groups"
  ON public.bot_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = bot_groups.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Users can delete bot_groups if they own the bot
CREATE POLICY "Users can delete their own bot_groups"
  ON public.bot_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = bot_groups.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Users can update bot_groups if they own the bot (for updating current_member_index)
CREATE POLICY "Users can update their own bot_groups"
  ON public.bot_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = bot_groups.bot_id
      AND bots.user_id = auth.uid()
    )
  );
