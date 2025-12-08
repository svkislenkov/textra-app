-- Add scheduling fields to bots table
ALTER TABLE bots
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS last_run_date DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create bot_groups table (links bots to groups for scheduling)
CREATE TABLE IF NOT EXISTS bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  current_member_index INTEGER DEFAULT 0,
  last_assigned_phone TEXT,
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, group_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_groups_bot_id ON bot_groups(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_groups_group_id ON bot_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_bots_is_active_last_run ON bots(is_active, last_run_date) WHERE is_active = true;

-- Create RLS policies for bot_groups
ALTER TABLE bot_groups ENABLE ROW LEVEL SECURITY;

-- Group owners can view bot assignments for their groups
CREATE POLICY "Group owners can view bot_groups"
  ON bot_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = bot_groups.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Group owners can insert bot assignments
CREATE POLICY "Group owners can insert bot_groups"
  ON bot_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = bot_groups.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Group owners can update bot assignments
CREATE POLICY "Group owners can update bot_groups"
  ON bot_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = bot_groups.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Group owners can delete bot assignments
CREATE POLICY "Group owners can delete bot_groups"
  ON bot_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = bot_groups.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Create message_log table for tracking sent messages
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  to_phone TEXT NOT NULL,
  to_name TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  twilio_sid TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_log_bot_id ON message_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_message_log_group_id ON message_log(group_id);
CREATE INDEX IF NOT EXISTS idx_message_log_created_at ON message_log(created_at);
