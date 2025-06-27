-- Add new fields to participants table
ALTER TABLE participants ADD COLUMN IF NOT EXISTS class TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS scholar_number TEXT;

-- Update existing participants with sample data
UPDATE participants SET 
  class = CASE 
    WHEN id % 3 = 0 THEN 'Class 12'
    WHEN id % 3 = 1 THEN 'Class 11' 
    ELSE 'Class 10'
  END,
  scholar_number = CASE 
    WHEN id % 3 = 0 THEN 'SCH' || LPAD(id::text, 4, '0')
    WHEN id % 3 = 1 THEN 'STU' || LPAD(id::text, 4, '0')
    ELSE 'REG' || LPAD(id::text, 4, '0')
  END
WHERE class IS NULL OR scholar_number IS NULL;

-- Update sample data to use team codes instead of school codes
UPDATE participants SET 
  school_code = CASE 
    WHEN team_id LIKE 'TEAM_%' THEN REPLACE(team_id, 'TEAM_', 'TEAM-')
    WHEN team_id LIKE 'RAP_%' THEN REPLACE(team_id, 'RAP_', 'RAP-')
    WHEN team_id LIKE 'ART_%' THEN REPLACE(team_id, 'ART_', 'ART-')
    ELSE team_id
  END;
