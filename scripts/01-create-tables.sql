-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  description TEXT,
  date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add rounds column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS rounds INTEGER DEFAULT 1;

-- Create judgment criteria table
CREATE TABLE IF NOT EXISTS judgment_criteria (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  criteria_name TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  school_code TEXT NOT NULL,
  team_id TEXT NOT NULL, -- Teams with same team_id belong together
  solo_marking BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create marks table
CREATE TABLE IF NOT EXISTS marks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  participant_id BIGINT REFERENCES participants(id) ON DELETE CASCADE,
  criteria_id BIGINT REFERENCES judgment_criteria(id) ON DELETE CASCADE,
  marks_obtained INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update the marks table to include round information
ALTER TABLE marks ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;

-- Update the unique constraint to include round_number
ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_participant_id_criteria_id_key;
ALTER TABLE marks ADD CONSTRAINT marks_participant_criteria_round_unique 
  UNIQUE(participant_id, criteria_id, round_number);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE judgment_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Public can read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public can read judgment_criteria" ON judgment_criteria FOR SELECT USING (true);
CREATE POLICY "Public can read participants" ON participants FOR SELECT USING (true);
CREATE POLICY "Public can read marks" ON marks FOR SELECT USING (true);
CREATE POLICY "Public can insert marks" ON marks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update marks" ON marks FOR UPDATE USING (true);
