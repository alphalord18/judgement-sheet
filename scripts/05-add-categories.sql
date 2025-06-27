-- Add category field to participants table
ALTER TABLE participants ADD COLUMN IF NOT EXISTS category TEXT;

-- Update existing participants with categories based on class
UPDATE participants SET 
  category = CASE 
    WHEN class = 'Class 12' THEN 'Senior Category'
    WHEN class = 'Class 11' THEN 'Junior Category' 
    WHEN class = 'Class 10' THEN 'Intermediate Category'
    ELSE 'General Category'
  END
WHERE category IS NULL;

-- Add more sample participants for different categories
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking, class, scholar_number, category) VALUES
-- Dance Battle - Senior Category
(1, 'Arjun Sharma', 'TEAM-D', 'TEAM_D', false, 'Class 12', 'SCH0007', 'Senior Category'),
(1, 'Priya Gupta', 'TEAM-D', 'TEAM_D', false, 'Class 12', 'SCH0008', 'Senior Category'),
-- Dance Battle - Intermediate Category  
(1, 'Rohit Kumar', 'TEAM-E', 'TEAM_E', false, 'Class 10', 'SCH0009', 'Intermediate Category'),
(1, 'Sneha Patel', 'TEAM-E', 'TEAM_E', false, 'Class 10', 'SCH0010', 'Intermediate Category'),

-- Rap Cypher - Different Categories
(2, 'Vikram Singh', 'RAP-C', 'RAP_C', true, 'Class 12', 'STU0005', 'Senior Category'),
(2, 'Ananya Reddy', 'RAP-C', 'RAP_C', true, 'Class 12', 'STU0006', 'Senior Category'),
(2, 'Karan Joshi', 'RAP-D', 'RAP_D', true, 'Class 10', 'STU0007', 'Intermediate Category'),
(2, 'Meera Shah', 'RAP-D', 'RAP_D', true, 'Class 10', 'STU0008', 'Intermediate Category'),

-- Art Showcase - Different Categories
(3, 'Ravi Agarwal', 'ART-4', 'ART_4', false, 'Class 11', 'REG0004', 'Junior Category'),
(3, 'Kavya Nair', 'ART-5', 'ART_5', false, 'Class 12', 'REG0005', 'Senior Category'),
(3, 'Amit Verma', 'ART-6', 'ART_6', false, 'Class 10', 'REG0006', 'Intermediate Category');
