from backend.app.services.responses import load_questions


def test_load_questions_structure():
    questions = load_questions()
    assert isinstance(questions, dict)
    assert len(questions) > 0


def test_questions_have_all_types():
    questions = load_questions()
    for role, types in questions.items():
        assert isinstance(types, dict), f"Role {role} should map to a dict"
        for interview_type, qs in types.items():
            assert isinstance(qs, list), f"{role}/{interview_type} should be a list"
            assert len(qs) > 0, f"{role}/{interview_type} should have at least 1 question"
            assert all(isinstance(q, str) for q in qs)


def test_software_engineering_exists():
    questions = load_questions()
    assert "software_engineering" in questions
    assert "behavioral" in questions["software_engineering"]
