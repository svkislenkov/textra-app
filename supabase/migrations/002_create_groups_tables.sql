-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security for groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Create policies for groups
CREATE POLICY "Users can view their own groups"
  ON public.groups
  FOR SELECT
  USING (auth.uid() = groups.user_id);

CREATE POLICY "Users can create their own groups"
  ON public.groups
  FOR INSERT
  WITH CHECK (auth.uid() = groups.user_id);

CREATE POLICY "Users can update their own groups"
  ON public.groups
  FOR UPDATE
  USING (auth.uid() = groups.user_id);

CREATE POLICY "Users can delete their own groups"
  ON public.groups
  FOR DELETE
  USING (auth.uid() = groups.user_id);

-- Enable Row Level Security for group_members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Create policies for group_members (members belong to groups that belong to users)
CREATE POLICY "Users can view members of their own groups"
  ON public.group_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to their own groups"
  ON public.group_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update members of their own groups"
  ON public.group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete members from their own groups"
  ON public.group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS groups_user_id_idx ON public.groups(user_id);
CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON public.group_members(group_id);
