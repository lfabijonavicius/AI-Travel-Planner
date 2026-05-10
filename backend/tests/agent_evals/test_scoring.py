from tests.agent_evals.scoring import _check_text


def test_check_text_handles_comma_separated_numbers():
    assert _check_text("budget_gbp", 2000, "within your £2,000 budget") is True
    assert _check_text("budget_gbp", 2000, "within your £2000 budget") is True
    assert _check_text("budget_gbp", 1500, "around £1,500 per person") is True


def test_check_text_misses_when_number_absent():
    assert _check_text("budget_gbp", 2000, "within your £3,000 budget") is False


def test_check_text_word_boundary_for_strings():
    assert _check_text("destination", "Tokyo", "Tokyo is wonderful") is True
    assert _check_text("destination", "Tokyo", "Tokyography is not a word") is False
