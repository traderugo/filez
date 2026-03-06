-- Invite-by-email: admin adds staff emails to a station

CREATE TABLE org_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(org_id, email)
);

CREATE INDEX idx_org_invites_email ON org_invites (email);
CREATE INDEX idx_org_invites_org_id ON org_invites (org_id);

ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

-- Admin can manage invites for their own stations
CREATE POLICY "admin_manage_invites" ON org_invites
  FOR ALL USING (org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Users can read invites sent to their email
CREATE POLICY "user_read_own_invites" ON org_invites
  FOR SELECT USING (email = (SELECT email FROM users WHERE id = auth.uid()));
