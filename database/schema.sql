-- ============================================================
-- InterviewAI Coach — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New query
-- ============================================================

-- ── Questions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role          TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('behavioral', 'technical', 'mixed')),
  difficulty    INT         NOT NULL DEFAULT 1 CHECK (difficulty IN (0, 1, 2)),
  question_text TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- difficulty: 0 = easy | 1 = medium | 2 = hard

CREATE INDEX IF NOT EXISTS idx_questions_role_type ON questions (role, type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty  ON questions (difficulty);

-- ── Responses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  question_id   UUID        NOT NULL REFERENCES questions (id) ON DELETE SET NULL,
  transcript    TEXT        NOT NULL,
  clarity       FLOAT,
  conciseness   FLOAT,
  structure     FLOAT,
  confidence    FLOAT,
  relevance     FLOAT,
  overall_score FLOAT,
  suggestion    TEXT,
  encouragement TEXT,
  filler_count  INT         DEFAULT 0,
  filler_rate   FLOAT       DEFAULT 0.0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses (user_id);

-- ── Row-Level Security ─────────────────────────────────────────
-- Enable RLS on both tables
ALTER TABLE questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses  ENABLE ROW LEVEL SECURITY;

-- Anyone can read questions (public question bank)
CREATE POLICY "questions_read_all"
  ON questions FOR SELECT USING (true);

-- Users can only read/write their own responses (MVP: permissive insert)
CREATE POLICY "responses_insert_any"
  ON responses FOR INSERT WITH CHECK (true);

CREATE POLICY "responses_read_own"
  ON responses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "responses_delete_own"
  ON responses FOR DELETE USING (auth.uid() = user_id);
