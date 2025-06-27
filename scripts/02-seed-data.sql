-- Insert sample events
INSERT INTO events (name, description, date, is_active) VALUES
('Dance Battle 2024', 'Epic dance competition with sick moves', '2024-07-15', true),
('Rap Cypher Championship', 'Spit bars and drop beats', '2024-07-20', true),
('Art Showcase Vibes', 'Creative expression unleashed', '2024-07-25', true);

-- Update events to include rounds
UPDATE events SET rounds = 2 WHERE name = 'Dance Battle 2024';
UPDATE events SET rounds = 1 WHERE name = 'Rap Cypher Championship';
UPDATE events SET rounds = 3 WHERE name = 'Art Showcase Vibes';

-- Insert judgment criteria for Dance Battle
INSERT INTO judgment_criteria (event_id, criteria_name, max_marks) VALUES
(1, 'Choreography', 25),
(1, 'Synchronization', 20),
(1, 'Creativity', 25),
(1, 'Stage Presence', 20),
(1, 'Costume & Theme', 10);

-- Insert judgment criteria for Rap Cypher
INSERT INTO judgment_criteria (event_id, criteria_name, max_marks) VALUES
(2, 'Lyrical Content', 30),
(2, 'Flow & Rhythm', 25),
(2, 'Originality', 25),
(2, 'Stage Confidence', 20);

-- Insert judgment criteria for Art Showcase
INSERT INTO judgment_criteria (event_id, criteria_name, max_marks) VALUES
(3, 'Technical Skill', 30),
(3, 'Creativity', 25),
(3, 'Concept & Message', 25),
(3, 'Presentation', 20);

-- Insert participants for Dance Battle (team event)
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking) VALUES
(1, 'Alex Chen', 'SCH001', 'TEAM_A', false),
(1, 'Maya Patel', 'SCH001', 'TEAM_A', false),
(1, 'Jordan Smith', 'SCH002', 'TEAM_B', false),
(1, 'Riley Johnson', 'SCH002', 'TEAM_B', false),
(1, 'Casey Wong', 'SCH003', 'TEAM_C', false),
(1, 'Taylor Brown', 'SCH003', 'TEAM_C', false);

-- Insert participants for Rap Cypher (solo marking but team results)
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking) VALUES
(2, 'MC Thunder', 'SCH001', 'RAP_A', true),
(2, 'Lil Phoenix', 'SCH001', 'RAP_A', true),
(2, 'Beat Master', 'SCH002', 'RAP_B', true),
(2, 'Rhyme Queen', 'SCH002', 'RAP_B', true);

-- Insert participants for Art Showcase (individual)
INSERT INTO participants (event_id, name, school_code, team_id, solo_marking) VALUES
(3, 'Zoe Martinez', 'SCH001', 'ART_1', false),
(3, 'Sam Kim', 'SCH002', 'ART_2', false),
(3, 'Avery Davis', 'SCH003', 'ART_3', false);
