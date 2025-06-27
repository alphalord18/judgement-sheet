-- Drop existing admin_users table and recreate with event access
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE admin_users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_god_admin BOOLEAN DEFAULT false,
  event_access TEXT[], -- Array of event IDs this admin can access
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert god admin (access to all events)
INSERT INTO admin_users (email, username, password_hash, is_god_admin, event_access) VALUES
('admin@judgeit.com', 'admin', 'admin123', true, NULL);

-- Insert event-specific admins
INSERT INTO admin_users (email, username, password_hash, is_god_admin, event_access) VALUES
('dance@judgeit.com', 'dance_admin', 'dance123', false, ARRAY['1']),
('rap@judgeit.com', 'rap_admin', 'rap123', false, ARRAY['2']),
('art@judgeit.com', 'art_admin', 'art123', false, ARRAY['3']);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies for admin users
CREATE POLICY "Public can read admin_users for login" ON admin_users FOR SELECT USING (true);
