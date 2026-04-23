from pathlib import Path

SKILLS_DIR = Path(__file__).parent.parent / "skills"


def load_skill(skill_name: str) -> str:
    """Load a skill markdown file. Returns empty string if not found — never raises."""
    skill_path = SKILLS_DIR / f"{skill_name}.md"
    if not skill_path.exists():
        return ""
    return skill_path.read_text(encoding="utf-8")


def inject_skill(skill_name: str, base_prompt: str) -> str:
    """Prepend skill content to a prompt. Returns base_prompt unchanged if skill missing."""
    skill_content = load_skill(skill_name)
    if not skill_content:
        return base_prompt
    return f"{skill_content}\n\n---\n\n{base_prompt}"
