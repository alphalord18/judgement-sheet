-- Clear existing participants and marks
DELETE FROM marks;
DELETE FROM participants;

-- Insert fresh participant data with proper details
-- Dance Battle 2024 (Event ID: 1) - Team Event
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking, class, scholar_number, category) VALUES
-- Team A - Senior Category
(1, 'Arjun Sharma', 'TEAM-A', 'TEAM_A', false, 'Class 12-A', 'SCH2024001', 'Senior Category'),
(1, 'Priya Gupta', 'TEAM-A', 'TEAM_A', false, 'Class 12-B', 'SCH2024002', 'Senior Category'),
(1, 'Rohit Kumar', 'TEAM-A', 'TEAM_A', false, 'Class 12-A', 'SCH2024003', 'Senior Category'),

-- Team B - Senior Category  
(1, 'Sneha Patel', 'TEAM-B', 'TEAM_B', false, 'Class 12-C', 'SCH2024004', 'Senior Category'),
(1, 'Vikram Singh', 'TEAM-B', 'TEAM_B', false, 'Class 12-A', 'SCH2024005', 'Senior Category'),
(1, 'Ananya Reddy', 'TEAM-B', 'TEAM_B', false, 'Class 12-B', 'SCH2024006', 'Senior Category'),

-- Team C - Junior Category
(1, 'Karan Joshi', 'TEAM-C', 'TEAM_C', false, 'Class 11-A', 'SCH2024007', 'Junior Category'),
(1, 'Meera Shah', 'TEAM-C', 'TEAM_C', false, 'Class 11-B', 'SCH2024008', 'Junior Category'),
(1, 'Ravi Agarwal', 'TEAM-C', 'TEAM_C', false, 'Class 11-A', 'SCH2024009', 'Junior Category'),

-- Team D - Junior Category
(1, 'Kavya Nair', 'TEAM-D', 'TEAM_D', false, 'Class 11-C', 'SCH2024010', 'Junior Category'),
(1, 'Amit Verma', 'TEAM-D', 'TEAM_D', false, 'Class 11-A', 'SCH2024011', 'Junior Category'),
(1, 'Pooja Sharma', 'TEAM-D', 'TEAM_D', false, 'Class 11-B', 'SCH2024012', 'Junior Category'),

-- Team E - Intermediate Category
(1, 'Rahul Gupta', 'TEAM-E', 'TEAM_E', false, 'Class 10-A', 'SCH2024013', 'Intermediate Category'),
(1, 'Sanya Patel', 'TEAM-E', 'TEAM_E', false, 'Class 10-B', 'SCH2024014', 'Intermediate Category'),
(1, 'Dev Kumar', 'TEAM-E', 'TEAM_E', false, 'Class 10-A', 'SCH2024015', 'Intermediate Category');

-- Rap Cypher Championship (Event ID: 2) - Solo Marking but Team Results
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking, class, scholar_number, category) VALUES
-- Team A - Senior Category
(2, 'MC Thunder', 'RAP-A', 'RAP_A', true, 'Class 12-A', 'RAP2024001', 'Senior Category'),
(2, 'Lil Phoenix', 'RAP-A', 'RAP_A', true, 'Class 12-B', 'RAP2024002', 'Senior Category'),

-- Team B - Senior Category
(2, 'Beat Master', 'RAP-B', 'RAP_B', true, 'Class 12-C', 'RAP2024003', 'Senior Category'),
(2, 'Rhyme Queen', 'RAP-B', 'RAP_B', true, 'Class 12-A', 'RAP2024004', 'Senior Category'),

-- Team C - Junior Category
(2, 'Flow King', 'RAP-C', 'RAP_C', true, 'Class 11-A', 'RAP2024005', 'Junior Category'),
(2, 'Verse Master', 'RAP-C', 'RAP_C', true, 'Class 11-B', 'RAP2024006', 'Junior Category'),

-- Team D - Junior Category
(2, 'Rhythm Star', 'RAP-D', 'RAP_D', true, 'Class 11-C', 'RAP2024007', 'Junior Category'),
(2, 'Lyric Genius', 'RAP-D', 'RAP_D', true, 'Class 11-A', 'RAP2024008', 'Junior Category'),

-- Team E - Intermediate Category
(2, 'Young Rapper', 'RAP-E', 'RAP_E', true, 'Class 10-A', 'RAP2024009', 'Intermediate Category'),
(2, 'Fresh Beats', 'RAP-E', 'RAP_E', true, 'Class 10-B', 'RAP2024010', 'Intermediate Category');

-- Art Showcase Vibes (Event ID: 3) - Individual Event
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking, class, scholar_number, category) VALUES
-- Senior Category
(3, 'Zoe Martinez', 'ART-001', 'ART_1', false, 'Class 12-A', 'ART2024001', 'Senior Category'),
(3, 'Sam Kim', 'ART-002', 'ART_2', false, 'Class 12-B', 'ART2024002', 'Senior Category'),
(3, 'Avery Davis', 'ART-003', 'ART_3', false, 'Class 12-C', 'ART2024003', 'Senior Category'),
(3, 'Jordan Lee', 'ART-004', 'ART_4', false, 'Class 12-A', 'ART2024004', 'Senior Category'),

-- Junior Category
(3, 'Taylor Swift', 'ART-005', 'ART_5', false, 'Class 11-A', 'ART2024005', 'Junior Category'),
(3, 'Blake Johnson', 'ART-006', 'ART_6', false, 'Class 11-B', 'ART2024006', 'Junior Category'),
(3, 'Casey Wilson', 'ART-007', 'ART_7', false, 'Class 11-C', 'ART2024007', 'Junior Category'),
(3, 'Morgan Brown', 'ART-008', 'ART_8', false, 'Class 11-A', 'ART2024008', 'Junior Category'),

-- Intermediate Category
(3, 'River Chen', 'ART-009', 'ART_9', false, 'Class 10-A', 'ART2024009', 'Intermediate Category'),
(3, 'Sage Patel', 'ART-010', 'ART_10', false, 'Class 10-B', 'ART2024010', 'Intermediate Category'),
(3, 'Phoenix Kumar', 'ART-011', 'ART_11', false, 'Class 10-C', 'ART2024011', 'Intermediate Category'),
(3, 'Skylar Singh', 'ART-012', 'ART_12', false, 'Class 10-A', 'ART2024012', 'Intermediate Category');

-- Reset all events to unlocked state
UPDATE events SET is_locked = false, locked_by = NULL, locked_at = NULL;
