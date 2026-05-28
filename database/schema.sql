-- InterviewAI Coach — Supabase schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query

-- ── Questions table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role         TEXT,
  type         TEXT CHECK (type IN ('behavioral', 'technical', 'mixed')),
  difficulty   INT  CHECK (difficulty IN (0, 1, 2)),  -- 0=easy 1=medium 2=hard
  question_text TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Responses table ────────────────────────────────────────────────────────────
-- question_id is stored for reference but has NO FK constraint —
-- questions are bundled in the frontend so the questions table is optional.
-- question_text is stored directly so responses are self-contained.
CREATE TABLE IF NOT EXISTS responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  question_id   TEXT,          -- deterministic ID from frontend; no FK
  question_text TEXT,          -- stored inline so no join needed
  transcript    TEXT,
  clarity       FLOAT,
  conciseness   FLOAT,
  structure     FLOAT,
  confidence    FLOAT,
  relevance     FLOAT,
  overall_score FLOAT,
  suggestion    TEXT,
  encouragement TEXT,
  filler_count  INT   DEFAULT 0,
  filler_rate   FLOAT DEFAULT 0.0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Questions: anyone can read
CREATE POLICY "questions_select_all" ON questions
  FOR SELECT USING (true);

-- Responses: users can only see and modify their own rows
CREATE POLICY "responses_insert_own" ON responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "responses_select_own" ON responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "responses_delete_own" ON responses
  FOR DELETE USING (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS responses_user_id_idx  ON responses (user_id);
CREATE INDEX IF NOT EXISTS responses_created_at_idx ON responses (created_at DESC);
