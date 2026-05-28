"""
Seed Supabase questions table from questions/questions.json.

Usage:
    python database/seed.py

Requires SUPABASE_URL and SUPABASE_ANON_KEY in environment (or .env).
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

QUESTIONS_JSON = Path(__file__).parent.parent / "questions" / "questions.json"

# difficulty heuristic: technical → hard (2), behavioral → easy (0), mixed → medium (1)
DIFFICULTY_MAP = {"behavioral": 0, "technical": 2, "mixed": 1}


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    with open(QUESTIONS_JSON) as f:
        bank = json.load(f)

    rows = []
    for role, types in bank.items():
        for qtype, questions in types.items():
            difficulty = DIFFICULTY_MAP.get(qtype, 1)
            for text in questions:
                rows.append({
                    "role": role,
                    "type": qtype,
                    "difficulty": difficulty,
                    "question_text": text,
                })

    print(f"Seeding {len(rows)} questions…")
    # Upsert in batches of 50
    for i in range(0, len(rows), 50):
        batch = rows[i:i + 50]
        client.table("questions").insert(batch).execute()
        print(f"  inserted rows {i + 1}–{i + len(batch)}")

    print("Done.")


if __name__ == "__main__":
    main()
