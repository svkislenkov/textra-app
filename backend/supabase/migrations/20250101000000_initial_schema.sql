-- Create bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  schedule_time_local TEXT NOT NULL, -- HH:MM format
  twilio_number TEXT,
  twilio_messaging_service_sid TEXT,
  conversation_sid TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sent_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create bot_members table
CREATE TABLE IF NOT EXISTS bot_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  is_opted_in BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_id, phone_e164)
);

-- Create chores table
CREATE TABLE IF NOT EXISTS chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_id, title)
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES bot_members(id) ON DELETE CASCADE,
  chore_id UUID NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  position_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create message_log table
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  twilio_sid TEXT,
  to_phone TEXT,
  status TEXT,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bot_members_bot_id ON bot_members(bot_id);
CREATE INDEX IF NOT EXISTS idx_chores_bot_id ON chores(bot_id);
CREATE INDEX IF NOT EXISTS idx_assignments_bot_id ON assignments(bot_id);
CREATE INDEX IF NOT EXISTS idx_message_log_bot_id ON message_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_bots_is_active ON bots(is_active);

-- Create unique index for chore titles (required by bot-chores function)
CREATE UNIQUE INDEX IF NOT EXISTS uq_chore_title ON chores(bot_id, title);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_members_updated_at BEFORE UPDATE ON bot_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chores_updated_at BEFORE UPDATE ON chores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
