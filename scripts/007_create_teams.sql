-- Create teams table for company-specific teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Drop old policy if exists
DROP POLICY IF EXISTS teams_select_all ON teams;

-- RLS Policy: Users can only see teams from their own company
CREATE POLICY teams_select_own_company ON teams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company = teams.company
    )
  );

CREATE POLICY teams_insert_admin ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert default teams for each company
INSERT INTO teams (name, company, logo_url) VALUES
  -- Adobe teams
  ('Photoshop', 'Adobe', '/images/teams/photoshop.png'),
  ('Illustrator', 'Adobe', '/images/teams/illustrator.png'),
  ('InDesign', 'Adobe', '/images/teams/indesign.png'),
  -- Google teams
  ('Google Drive', 'Google', '/images/teams/drive.png'),
  ('Google Gemini', 'Google', '/images/teams/gemini.png'),
  ('YouTube', 'Google', '/images/teams/youtube.png'),
  -- Electronic Arts teams
  ('EA Sports FC', 'Electronic Arts', '/images/teams/fc.png'),
  ('Apex Legends', 'Electronic Arts', '/images/teams/apex.png'),
  ('The Sims', 'Electronic Arts', '/images/teams/sims.png')
ON CONFLICT DO NOTHING;
