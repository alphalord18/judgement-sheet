-- First, let's make sure all tables have the correct structure
-- Drop and recreate the marks table with proper structure
DROP TABLE IF EXISTS marks CASCADE;

CREATE TABLE marks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  participant_id BIGINT REFERENCES participants(id) ON DELETE CASCADE,
  criteria_id BIGINT REFERENCES judgment_criteria(id) ON DELETE CASCADE,
  marks_obtained INTEGER DEFAULT 0,
  round_number INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, criteria_id, round_number)
);

-- Add rounds column to events if it doesn't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS rounds INTEGER DEFAULT 1;

-- Update events with proper round values
UPDATE events SET rounds = 2 WHERE name LIKE '%Dance%';
UPDATE events SET rounds = 1 WHERE name LIKE '%Rap%';
UPDATE events SET rounds = 3 WHERE name LIKE '%Art%';

-- Ensure all events have at least 1 round
UPDATE events SET rounds = 1 WHERE rounds IS NULL OR rounds < 1;

-- Enable RLS on marks table
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

-- Create policies for marks table
DROP POLICY IF EXISTS "Public can read marks" ON marks;
DROP POLICY IF EXISTS "Public can insert marks" ON marks;
DROP POLICY IF EXISTS "Public can update marks" ON marks;

CREATE POLICY "Public can read marks" ON marks FOR SELECT USING (true);
CREATE POLICY "Public can insert marks" ON marks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update marks" ON marks FOR UPDATE USING (true);
