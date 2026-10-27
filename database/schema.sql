CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  categories TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS citizen_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citizen_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES citizen_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'reopened')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high')),
  department_id INTEGER REFERENCES departments(id),
  reporter_user_id UUID REFERENCES citizen_users(id) ON DELETE SET NULL,
  duplicate_of UUID REFERENCES complaints(id),
  evidence_url TEXT,
  resolution_note TEXT,
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ
);

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS reporter_user_id UUID REFERENCES citizen_users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS complaint_events (
  id BIGSERIAL PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status);
CREATE INDEX IF NOT EXISTS complaints_reporter_user_idx ON complaints(reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS citizen_sessions_expiry_idx ON citizen_sessions(expires_at);
CREATE INDEX IF NOT EXISTS complaints_due_at_idx ON complaints(due_at)
  WHERE status IN ('open', 'in_progress', 'reopened');
CREATE INDEX IF NOT EXISTS complaint_events_case_idx
  ON complaint_events(complaint_id, created_at);

INSERT INTO departments (name, categories) VALUES
  ('Roads & Transport', ARRAY['roads', 'traffic']),
  ('Water & Sanitation', ARRAY['water', 'sanitation', 'drainage', 'sewage']),
  ('Parks & Public Spaces', ARRAY['parks', 'streetlights']),
  ('Public Safety', ARRAY['safety', 'other']),
  ('Environment & Air Quality', ARRAY['pollution']),
  ('Public Health', ARRAY['health']),
  ('Utilities & Power', ARRAY['electricity']),
  ('Weather & Disaster Response', ARRAY['weather'])
ON CONFLICT (name) DO UPDATE SET categories = EXCLUDED.categories;
