"""
Skill graph used by the ATS checker.

Nodes are canonical skills; edges are
  * ALIASES  — different spellings of one node ("js" -> "javascript"), and
  * IMPLIES  — having the child node is evidence for the parent
               ("react" implies "javascript"), so a resume that says React
               is not penalised for not repeating "JavaScript".

Pure local data + code: matching costs nothing (no LLM / API calls).
"""

import re

ALIASES = {
    "js": "javascript", "ecmascript": "javascript", "ts": "typescript",
    "reactjs": "react", "react.js": "react", "nodejs": "node.js", "node": "node.js",
    "nextjs": "next.js", "vuejs": "vue", "vue.js": "vue", "angularjs": "angular",
    "py": "python", "golang": "go", "postgres": "postgresql", "psql": "postgresql",
    "mongo": "mongodb", "k8s": "kubernetes", "gcp": "google cloud", "amazon web services": "aws",
    "ml": "machine learning", "dl": "deep learning", "nlp": "natural language processing",
    "ci/cd": "ci cd", "cicd": "ci cd", "rest": "rest api", "restful": "rest api",
    "restful api": "rest api", "restful apis": "rest api", "rest apis": "rest api",
    "dsa": "data structures", "oop": "object oriented", "sklearn": "scikit-learn",
    "c sharp": "c#", "dotnet": ".net", "tailwindcss": "tailwind",
}

IMPLIES = {
    "react": ["javascript"], "next.js": ["react", "javascript"], "vue": ["javascript"],
    "angular": ["typescript", "javascript"], "typescript": ["javascript"],
    "node.js": ["javascript"], "express": ["node.js"], "django": ["python"],
    "flask": ["python"], "fastapi": ["python"], "pandas": ["python"], "numpy": ["python"],
    "pytorch": ["python", "deep learning"], "tensorflow": ["python", "deep learning"],
    "scikit-learn": ["python", "machine learning"], "spring": ["java"],
    "postgresql": ["sql"], "mysql": ["sql"], "kubernetes": ["docker"],
}

# Vocabulary of recognised skills (canonical names).
SKILLS = set(ALIASES.values()) | set(IMPLIES) | {s for v in IMPLIES.values() for s in v} | {
    "java", "c++", "rust", "kotlin", "swift", "php", "ruby", "rails", "graphql", "redis",
    "kafka", "rabbitmq", "terraform", "ansible", "jenkins", "git", "linux", "azure",
    "html", "css", "sass", "redux", "jest", "cypress", "selenium", "figma", "excel",
    "tableau", "power bi", "spark", "hadoop", "airflow", "etl", "data analysis",
    "statistics", "agile", "scrum", "jira", "microservices", "system design",
    "unit testing", "devops", "android", "ios", "flutter", "react native", "seo",
    "communication", "leadership", "product management", "sales", "marketing",
    "llm", "generative ai", "prompt engineering", "api", "oauth", "websocket",
}

_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#.\-/]*[a-z0-9+#]|[a-z0-9]")


def _normalise(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9+#./\- ]+", " ", text.lower()) + " "


def _surface_forms() -> dict[str, str]:
    forms = {s: s for s in SKILLS}
    forms.update(ALIASES)
    return forms


_FORMS = _surface_forms()
# Longest first so "react native" wins over "react".
_ORDERED_FORMS = sorted(_FORMS, key=len, reverse=True)
_FORM_RES = {f: re.compile(r"(?<![a-z0-9+#])" + re.escape(f) + r"(?![a-z0-9+#])") for f in _ORDERED_FORMS}


def extract_skills(text: str) -> set[str]:
    """Canonical skills explicitly mentioned in `text`."""
    norm = _normalise(text)
    return {_FORMS[f] for f in _ORDERED_FORMS if _FORM_RES[f].search(norm)}


def expand(skills: set[str]) -> set[str]:
    """Close a skill set over IMPLIES edges (BFS)."""
    seen, frontier = set(skills), list(skills)
    while frontier:
        for nxt in IMPLIES.get(frontier.pop(), []):
            if nxt not in seen:
                seen.add(nxt)
                frontier.append(nxt)
    return seen
