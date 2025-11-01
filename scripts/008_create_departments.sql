-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY departments_select_all ON departments
  FOR SELECT TO authenticated
  USING (true);

-- Insert default departments with access codes
DO $$
DECLARE
  team_record RECORD;
BEGIN
  -- Adobe > Photoshop
  SELECT id INTO team_record FROM teams WHERE name = 'Photoshop' AND company = 'Adobe' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'PS-DEV-2847'),
      (team_record.id, 'Marketing', 'PS-MKT-6193'),
      (team_record.id, 'CyberSecurity', 'PS-SEC-9251'),
      (team_record.id, 'Finance', 'PS-FIN-4738'),
      (team_record.id, 'Design', 'PS-DSG-8462')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Adobe > Illustrator
  SELECT id INTO team_record FROM teams WHERE name = 'Illustrator' AND company = 'Adobe' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'AI-DEV-5629'),
      (team_record.id, 'Marketing', 'AI-MKT-3874'),
      (team_record.id, 'CyberSecurity', 'AI-SEC-7415'),
      (team_record.id, 'Finance', 'AI-FIN-1938'),
      (team_record.id, 'Design', 'AI-DSG-6207')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Adobe > InDesign
  SELECT id INTO team_record FROM teams WHERE name = 'InDesign' AND company = 'Adobe' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'ID-DEV-8134'),
      (team_record.id, 'Marketing', 'ID-MKT-2956'),
      (team_record.id, 'CyberSecurity', 'ID-SEC-4682'),
      (team_record.id, 'Finance', 'ID-FIN-7209'),
      (team_record.id, 'Design', 'ID-DSG-3571')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Google > Google Drive
  SELECT id INTO team_record FROM teams WHERE name = 'Google Drive' AND company = 'Google' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'GD-DEV-4829'),
      (team_record.id, 'Marketing', 'GD-MKT-7153'),
      (team_record.id, 'CyberSecurity', 'GD-SEC-2648'),
      (team_record.id, 'Finance', 'GD-FIN-9372'),
      (team_record.id, 'Design', 'GD-DSG-5816')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Google > Google Gemini
  SELECT id INTO team_record FROM teams WHERE name = 'Google Gemini' AND company = 'Google' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'GG-DEV-6294'),
      (team_record.id, 'Marketing', 'GG-MKT-8517'),
      (team_record.id, 'CyberSecurity', 'GG-SEC-3762'),
      (team_record.id, 'Finance', 'GG-FIN-1485'),
      (team_record.id, 'Design', 'GG-DSG-9028')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Google > YouTube
  SELECT id INTO team_record FROM teams WHERE name = 'YouTube' AND company = 'Google' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'YT-DEV-7351'),
      (team_record.id, 'Marketing', 'YT-MKT-4926'),
      (team_record.id, 'CyberSecurity', 'YT-SEC-8174'),
      (team_record.id, 'Finance', 'YT-FIN-2539'),
      (team_record.id, 'Design', 'YT-DSG-6803')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Electronic Arts > EA Sports FC
  SELECT id INTO team_record FROM teams WHERE name = 'EA Sports FC' AND company = 'Electronic Arts' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'FC-DEV-3847'),
      (team_record.id, 'Marketing', 'FC-MKT-9162'),
      (team_record.id, 'CyberSecurity', 'FC-SEC-5729'),
      (team_record.id, 'Finance', 'FC-FIN-8314'),
      (team_record.id, 'Design', 'FC-DSG-2486')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Electronic Arts > Apex Legends
  SELECT id INTO team_record FROM teams WHERE name = 'Apex Legends' AND company = 'Electronic Arts' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'AL-DEV-6519'),
      (team_record.id, 'Marketing', 'AL-MKT-2873'),
      (team_record.id, 'CyberSecurity', 'AL-SEC-9246'),
      (team_record.id, 'Finance', 'AL-FIN-4701'),
      (team_record.id, 'Design', 'AL-DSG-7358')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Electronic Arts > The Sims
  SELECT id INTO team_record FROM teams WHERE name = 'The Sims' AND company = 'Electronic Arts' LIMIT 1;
  IF FOUND THEN
    INSERT INTO departments (team_id, name, access_code) VALUES
      (team_record.id, 'Software Development', 'TS-DEV-9283'),
      (team_record.id, 'Marketing', 'TS-MKT-5746'),
      (team_record.id, 'CyberSecurity', 'TS-SEC-1829'),
      (team_record.id, 'Finance', 'TS-FIN-6154'),
      (team_record.id, 'Design', 'TS-DSG-4097')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
