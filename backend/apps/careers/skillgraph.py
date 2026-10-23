"""
Skill graph used by the ATS checker, job ingest and Best match.

Nodes are canonical skills; edges are
  * ALIASES  — different spellings of one node ("js" -> "javascript"), and
  * IMPLIES  — having the child node is evidence for the parent
               ("react" implies "javascript"), so a resume that says React
               is not penalised for not repeating "JavaScript".

Words that are also plain English ("go", "rest", "excel", "express") only
count in their capitalised form (CASE_SENSITIVE), and a few verbs are
skipped by context ("react to incidents").

Pure local data + code: matching costs nothing (no LLM / API calls).
"""

import re

ALIASES = {
    # languages
    "js": "javascript", "ecmascript": "javascript", "es6": "javascript", "vanilla js": "javascript",
    "ts": "typescript", "py": "python", "python3": "python", "golang": "go", "c sharp": "c#",
    "cpp": "c++", "objective c": "objective-c", "r programming": "r", "r language": "r", "rstudio": "r",
    "shell scripting": "bash", "shell script": "bash", "unix shell": "bash",
    "pl/sql": "plsql", "t-sql": "tsql", "transact-sql": "tsql",
    # frontend
    "reactjs": "react", "react.js": "react", "react js": "react", "nextjs": "next.js", "next js": "next.js",
    "vuejs": "vue", "vue.js": "vue", "vue js": "vue", "nuxtjs": "nuxt", "nuxt.js": "nuxt",
    "angularjs": "angular", "angular.js": "angular", "sveltekit": "svelte", "tailwindcss": "tailwind",
    "tailwind css": "tailwind", "scss": "sass", "html5": "html", "css3": "css", "mui": "material ui",
    "material-ui": "material ui", "d3": "d3.js", "threejs": "three.js", "a11y": "accessibility",
    "wcag": "accessibility", "web accessibility": "accessibility", "redux toolkit": "redux",
    # backend
    "nodejs": "node.js", "node js": "node.js", "node": "node.js", "expressjs": "express",
    "express.js": "express", "nest.js": "nestjs", "springboot": "spring boot", "dotnet": ".net",
    ".net core": ".net", "asp.net core": "asp.net", "ruby on rails": "rails", "ror": "rails",
    "restful": "rest api", "restful api": "rest api", "restful apis": "rest api",
    "rest apis": "rest api", "restful services": "rest api", "web sockets": "websocket",
    "websockets": "websocket", "micro-services": "microservices", "microservice": "microservices",
    "message queues": "message queue", "event driven": "event-driven", "event-driven architecture": "event-driven",
    # data stores
    "postgres": "postgresql", "psql": "postgresql", "mongo": "mongodb", "ms sql": "sql server",
    "mssql": "sql server", "microsoft sql server": "sql server", "elastic search": "elasticsearch",
    "elk": "elasticsearch", "opensearch": "elasticsearch", "dynamo db": "dynamodb", "big query": "bigquery",
    "no-sql": "nosql", "oracle db": "oracle", "oracle database": "oracle",
    # cloud / devops
    "k8s": "kubernetes", "gcp": "google cloud", "google cloud platform": "google cloud",
    "amazon web services": "aws", "microsoft azure": "azure", "ci/cd": "ci cd", "cicd": "ci cd",
    "ci-cd": "ci cd", "continuous integration": "ci cd", "github action": "github actions",
    "gitlab ci/cd": "gitlab ci", "argo cd": "argocd", "iac": "infrastructure as code", "amazon s3": "s3", "amazon ec2": "ec2", "amazon eks": "eks",
    "site reliability": "sre", "site reliability engineering": "sre", "github": "git", "gitlab": "git",
    "bitbucket": "git", "unix": "linux",
    # data / ml
    "ml": "machine learning", "dl": "deep learning", "nlp": "natural language processing",
    "sklearn": "scikit-learn", "scikit learn": "scikit-learn",
    "large language models": "llm", "large language model": "llm", "llms": "llm", "genai": "generative ai",
    "gen ai": "generative ai", "retrieval augmented generation": "rag", "retrieval-augmented generation": "rag",
    "huggingface": "hugging face", "apache spark": "spark", "apache kafka": "kafka", "apache airflow": "airflow",
    "powerbi": "power bi", "ms excel": "excel", "microsoft excel": "excel", "advanced excel": "excel",
    "a/b testing": "ab testing", "a/b tests": "ab testing", "data viz": "data visualization",
    "data visualisation": "data visualization", "data warehouse": "data warehousing",
    "data modelling": "data modeling", "statistical analysis": "statistics",
    # testing
    "unit tests": "unit testing", "automation testing": "test automation", "automated testing": "test automation",
    "test-driven development": "tdd", "test driven development": "tdd", "qa": "quality assurance",
    # practices
    "dsa": "data structures", "data structures and algorithms": "data structures",
    "oop": "object oriented", "oops": "object oriented", "object-oriented": "object oriented",
    "object oriented programming": "object oriented", "object-oriented programming": "object oriented",
    "distributed system": "distributed systems", "low level design": "system design",
    "high level design": "system design", "lld": "system design", "hld": "system design",
    # design / business
    "ui/ux": "ux design", "ux": "ux design", "user experience": "ux design",
    "user interface design": "ui design", "adobe photoshop": "photoshop", "adobe illustrator": "illustrator",
    "product manager": "product management", "search engine optimization": "seo",
    "search engine optimisation": "seo", "ppc": "sem", "google ads": "sem",
    "sfdc": "salesforce", "ga4": "google analytics", "business analytics": "business analysis",
    "stakeholder communication": "stakeholder management", "team player": "teamwork",
    "problem-solving": "problem solving", "verbal and written communication": "communication",
    "communication skills": "communication", "embedded c": "embedded systems", "internet of things": "iot",
}

IMPLIES = {
    "react": ["javascript"], "next.js": ["react", "javascript"], "vue": ["javascript"],
    "nuxt": ["vue", "javascript"], "svelte": ["javascript"], "angular": ["typescript", "javascript"],
    "typescript": ["javascript"], "node.js": ["javascript"], "express": ["node.js"],
    "nestjs": ["node.js", "typescript"], "redux": ["react"], "react native": ["react", "javascript"],
    "jquery": ["javascript"], "d3.js": ["javascript", "data visualization"], "three.js": ["javascript"],
    "tailwind": ["css"], "sass": ["css"], "bootstrap": ["css"], "material ui": ["react"],
    "django": ["python"], "flask": ["python"], "fastapi": ["python"], "pandas": ["python", "data analysis"],
    "numpy": ["python"], "pyspark": ["spark", "python"], "pytest": ["python", "unit testing"],
    "pytorch": ["python", "deep learning"], "tensorflow": ["python", "deep learning"],
    "keras": ["python", "deep learning"], "scikit-learn": ["python", "machine learning"],
    "xgboost": ["machine learning"], "deep learning": ["machine learning"],
    "natural language processing": ["machine learning"], "computer vision": ["machine learning"],
    "opencv": ["computer vision"], "hugging face": ["machine learning"], "langchain": ["llm", "python"],
    "rag": ["llm"], "llm": ["generative ai"], "prompt engineering": ["llm"], "mlops": ["machine learning"],
    "spring boot": ["spring", "java"], "spring": ["java"], "hibernate": ["java"], "junit": ["java", "unit testing"],
    "laravel": ["php"], "rails": ["ruby"], "asp.net": [".net", "c#"], "flutter": ["dart"],
    "swiftui": ["swift", "ios"], "jetpack compose": ["kotlin", "android"],
    "postgresql": ["sql"], "mysql": ["sql"], "sql server": ["sql"], "oracle": ["sql"], "sqlite": ["sql"],
    "snowflake": ["sql"], "bigquery": ["sql", "google cloud"], "redshift": ["sql", "aws"], "plsql": ["sql"],
    "tsql": ["sql", "sql server"], "mongodb": ["nosql"], "cassandra": ["nosql"], "dynamodb": ["nosql", "aws"],
    "databricks": ["spark"], "dbt": ["sql"], "kubernetes": ["docker"], "helm": ["kubernetes"],
    "eks": ["kubernetes", "aws"], "openshift": ["kubernetes"], "argocd": ["kubernetes"],
    "aws lambda": ["aws", "serverless"], "s3": ["aws"], "ec2": ["aws"],
    "terraform": ["infrastructure as code"], "ansible": ["infrastructure as code"],
    "cloudformation": ["aws", "infrastructure as code"], "github actions": ["ci cd"], "gitlab ci": ["ci cd"], "jenkins": ["ci cd"],
    "jest": ["javascript", "unit testing"], "mocha": ["javascript", "unit testing"],
    "cypress": ["test automation"], "selenium": ["test automation"], "playwright": ["test automation"],
    "appium": ["test automation"], "tdd": ["unit testing"], "scrum": ["agile"], "kanban": ["agile"],
    "tableau": ["data visualization"], "power bi": ["data visualization"], "looker": ["data visualization"],
    "rabbitmq": ["message queue"], "kafka": ["message queue"], "solidity": ["blockchain"],
    "ethereum": ["blockchain"], "web3": ["blockchain"], "hubspot": ["crm"], "salesforce": ["crm"],
    "verilog": ["fpga"], "vhdl": ["fpga"], "rtos": ["embedded systems"],
}

# Plain-English words: matched only with this exact capitalisation.
CASE_SENSITIVE = {
    "Go": "go", "REST": "rest api", "Excel": "excel", "Swift": "swift", "Spring": "spring",
    "Rust": "rust", "Express": "express", "Rails": "rails", "Dart": "dart", "Looker": "looker",
    "Helm": "helm", "Spark": "spark", "Jest": "jest", "Mocha": "mocha", "Snowflake": "snowflake",
    "Oracle": "oracle", "Ruby": "ruby", "Lambda": "aws lambda", "Hive": "hive", "Sketch": "sketch",
}

# Skip a match when the text right after it reads like ordinary English.
_NOT_FOLLOWED_BY = {
    "react": re.compile(r"\s+(?:to|quickly|swiftly|promptly|calmly)\b", re.I),
    "go": re.compile(r"[-\s]+(?:to|beyond|above|live|ahead|getter)\b", re.I),
    "excel": re.compile(r"\s+(?:at|in|as|with)\b", re.I),
    "spark": re.compile(r"\s+(?:joy|curiosity|ideas|change|conversations?|interest)\b", re.I),
}

# Soft skills: real but weak ATS signals, so they never weigh more than 1.
SOFT_SKILLS = {"communication", "leadership", "teamwork", "problem solving", "mentoring", "stakeholder management"}

# Vocabulary of recognised skills (canonical names).
SKILLS = (
    set(ALIASES.values()) | set(IMPLIES) | {s for v in IMPLIES.values() for s in v}
    | set(CASE_SENSITIVE.values()) | SOFT_SKILLS | {
        # languages
        "java", "c++", "kotlin", "php", "scala", "perl", "matlab", "elixir", "haskell", "lua",
        "powershell", "sql",
        # web / backend
        "html", "css", "webpack", "vite", "storybook", "graphql", "grpc", "redis", "nginx", "oauth",
        "api", "websocket", "responsive design",
        # data stores / pipelines
        "elasticsearch", "neo4j", "clickhouse", "firebase", "supabase", "hadoop", "etl",
        "data analysis", "data engineering", "data pipelines",
        # cloud / ops
        "terraform", "ansible", "linux", "prometheus", "grafana", "datadog", "istio", "devops",
        "observability", "serverless",
        # practices
        "agile", "jira", "confluence", "microservices", "system design", "algorithms",
        "design patterns", "unit testing", "integration testing", "manual testing", "postman", "jmeter",
        "code review", "performance optimization",
        # mobile
        "android", "ios", "react native", "xamarin",
        # security
        "cybersecurity", "penetration testing", "network security", "siem", "iam", "owasp",
        # design / product / business
        "figma", "adobe xd", "wireframing", "prototyping", "user research",
        "project management", "sales", "marketing", "digital marketing", "content marketing",
        "social media marketing", "lead generation", "b2b sales", "customer success", "sap",
        "financial modeling", "accounting", "tally", "gst",
        # ai / hardware
        "generative ai", "embedded systems", "iot", "microcontrollers", "pcb design",
    }
)


def _normalise(text: str) -> str:
    return " " + re.sub(r"[^A-Za-z0-9+#./\- ]+", " ", text or "") + " "


def _alternation(forms) -> str:
    # Longest first so "react native" wins over "react" and "java" can't eat "javascript".
    return "|".join(re.escape(f) for f in sorted(forms, key=len, reverse=True))


# Canonical names that are too ambiguous to match bare; only their aliases count.
_NO_BARE_FORM = {"r"}

_FORMS = {s: s for s in SKILLS if s not in _NO_BARE_FORM} | ALIASES
for _word in CASE_SENSITIVE:
    _FORMS.pop(_word.lower(), None)  # only the capitalised spelling (or a longer alias) counts
_CASED = CASE_SENSITIVE | {k.upper(): v for k, v in CASE_SENSITIVE.items()}
_TAGS = _FORMS | {k.lower(): v for k, v in CASE_SENSITIVE.items()}

_EDGE_L, _EDGE_R = r"(?<![A-Za-z0-9+#])", r"(?![A-Za-z0-9+#])"
_FORM_RE = re.compile(f"{_EDGE_L}(?:{_alternation(_FORMS)}){_EDGE_R}", re.I)
_CASED_RE = re.compile(f"{_EDGE_L}(?:{_alternation(_CASED)}){_EDGE_R}")


def locate(text: str):
    """(normalised text, [(start, end, canonical skill)] in text order)."""
    norm = _normalise(text)
    found = [(*m.span(), _FORMS[m.group(0).lower()]) for m in _FORM_RE.finditer(norm)]
    # Second pass for the capitalised words, skipping text the first pass already
    # read ("Spring Boot" is not also "Spring").
    found += [(*m.span(), _CASED[m.group(0)]) for m in _CASED_RE.finditer(norm)
              if not any(a <= m.start() < b for a, b, _ in found)]
    kept = [(a, b, skill) for a, b, skill in found
            if not (_NOT_FOLLOWED_BY.get(skill) and _NOT_FOLLOWED_BY[skill].match(norm, b))]
    return norm, sorted(kept)


def _matches(text: str):
    """Yield canonical skills found in `text` (repeats included)."""
    return (skill for _, _, skill in locate(text)[1])


def extract_skills(text: str) -> set[str]:
    """Canonical skills explicitly mentioned in `text`."""
    return set(_matches(text))


def count_skills(text: str) -> dict[str, int]:
    """Canonical skill -> number of mentions in `text`."""
    counts: dict[str, int] = {}
    for skill in _matches(text):
        counts[skill] = counts.get(skill, 0) + 1
    return counts


def skill_for_tag(tag: str) -> str | None:
    """Canonical skill for a structured job tag ("go", "Excel"); tags are
    labels, not prose, so the case-sensitive words are safe to match here."""
    return _TAGS.get((tag or "").strip().lower())


_LABELS = {
    "javascript": "JavaScript", "typescript": "TypeScript", "go": "Go", "c#": "C#", "c++": "C++", "r": "R",
    "php": "PHP", "sql": "SQL", "nosql": "NoSQL", "plsql": "PL/SQL", "tsql": "T-SQL", "html": "HTML", "css": "CSS",
    "graphql": "GraphQL", "grpc": "gRPC", "rest api": "REST API", "api": "APIs", "ci cd": "CI/CD", "aws": "AWS",
    "aws lambda": "AWS Lambda", "s3": "S3", "ec2": "EC2", "eks": "EKS", "iam": "IAM",
    "google cloud": "Google Cloud", "postgresql": "PostgreSQL", "mysql": "MySQL", "mongodb": "MongoDB",
    "dynamodb": "DynamoDB", "sql server": "SQL Server", "sqlite": "SQLite", "bigquery": "BigQuery",
    "clickhouse": "ClickHouse", "neo4j": "Neo4j", "fastapi": "FastAPI", "nestjs": "NestJS", "asp.net": "ASP.NET",
    ".net": ".NET", "ios": "iOS", "swiftui": "SwiftUI", "iot": "IoT", "llm": "LLMs", "rag": "RAG",
    "mlops": "MLOps", "etl": "ETL", "seo": "SEO", "sem": "SEM", "crm": "CRM", "sap": "SAP",
    "gst": "GST", "ux design": "UX design", "ui design": "UI design", "ab testing": "A/B testing", "tdd": "TDD",
    "sre": "SRE", "siem": "SIEM", "owasp": "OWASP", "fpga": "FPGA", "rtos": "RTOS", "vhdl": "VHDL",
    "dbt": "dbt", "github actions": "GitHub Actions", "gitlab ci": "GitLab CI", "argocd": "Argo CD",
    "pytorch": "PyTorch", "tensorflow": "TensorFlow", "scikit-learn": "scikit-learn", "numpy": "NumPy",
    "opencv": "OpenCV", "xgboost": "XGBoost", "langchain": "LangChain", "pyspark": "PySpark",
    "power bi": "Power BI", "jquery": "jQuery", "d3.js": "D3.js", "three.js": "Three.js",
    "oauth": "OAuth", "jmeter": "JMeter", "adobe xd": "Adobe XD", "hubspot": "HubSpot",
    "openshift": "OpenShift", "rabbitmq": "RabbitMQ", "devops": "DevOps", "jira": "Jira",
    "generative ai": "Generative AI", "b2b sales": "B2B sales", "websocket": "WebSockets", "pcb design": "PCB design",
}


def label(skill: str) -> str:
    """Display name for a canonical skill ("postgresql" -> "PostgreSQL")."""
    return _LABELS.get(skill) or (skill[:1].upper() + skill[1:])


def expand(skills: set[str]) -> set[str]:
    """Close a skill set over IMPLIES edges (BFS)."""
    seen, frontier = set(skills), list(skills)
    while frontier:
        for nxt in IMPLIES.get(frontier.pop(), []):
            if nxt not in seen:
                seen.add(nxt)
                frontier.append(nxt)
    return seen
