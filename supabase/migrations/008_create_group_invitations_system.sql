-- Create group_invitations table for managing invitation lifecycle
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  inviter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invitee_phone_number TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id),
  -- Prevent duplicate invitations to same group
  UNIQUE(group_id, invitee_phone_number)
);

-- Add invitation_status column to group_members
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'accepted'
CHECK (invitation_status IN ('pending', 'accepted'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS group_invitations_group_id_idx ON public.group_invitations(group_id);
CREATE INDEX IF NOT EXISTS group_invitations_phone_idx ON public.group_invitations(invitee_phone_number);
CREATE INDEX IF NOT EXISTS group_invitations_status_idx ON public.group_invitations(status);
CREATE INDEX IF NOT EXISTS group_members_invitation_status_idx ON public.group_members(invitation_status);

-- Enable Row Level Security for group_invitations
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- Group owners can view their group's invitations
CREATE POLICY "Group owners can view invitations"
  ON public.group_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_invitations.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Users can view invitations to their phone number
CREATE POLICY "Users can view their invitations"
  ON public.group_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.phone_number = group_invitations.invitee_phone_number
    )
  );

-- Group owners can create invitations
CREATE POLICY "Group owners can create invitations"
  ON public.group_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_invitations.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Invited users can update invitation status (accept/decline)
CREATE POLICY "Users can update their invitations"
  ON public.group_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.phone_number = group_invitations.invitee_phone_number
    )
  );

-- Group owners can delete invitations
CREATE POLICY "Group owners can delete invitations"
  ON public.group_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_invitations.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- Grandfather existing members as 'accepted'
UPDATE public.group_members
SET invitation_status = 'accepted'
WHERE invitation_status IS NULL;
