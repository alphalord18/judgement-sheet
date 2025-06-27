-- Check the current state of events table
SELECT id, name, is_locked, locked_by, locked_at FROM events;

-- Make sure the locking columns exist with proper defaults
ALTER TABLE events ALTER COLUMN is_locked SET DEFAULT false;

-- Clean up any NULL or empty values
UPDATE events SET is_locked = false WHERE is_locked IS NULL;
UPDATE events SET locked_by = NULL WHERE locked_by = '';
UPDATE events SET locked_at = NULL WHERE locked_at = '';

-- Verify the structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('is_locked', 'locked_by', 'locked_at');
