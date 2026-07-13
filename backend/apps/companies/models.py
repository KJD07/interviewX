from django.db import models


class Company(models.Model):
    class Kind(models.TextChoices):
        COMPANY = "company", "Company"
        SKILL = "skill", "Skill"

    name = models.CharField(max_length=100)
    tone_style = models.CharField(
        max_length=50,
        help_text='e.g. "formal_strict", "casual_friendly"',
    )
    description = models.TextField(blank=True)
    is_free = models.BooleanField(
        default=False,
        help_text="If true, free-plan users can access this company. Paid plans always see all companies.",
    )
    kind = models.CharField(
        max_length=10,
        choices=Kind.choices,
        default=Kind.COMPANY,
        help_text="'company' = a real company interview. 'skill' = a skill-based practice interview.",
    )
    category = models.CharField(
        max_length=100,
        blank=True,
        help_text="Grouping label for skills (e.g. 'Frontend', 'Backend', 'DevOps'). Unused for companies.",
    )

    class Meta:
        verbose_name_plural = "Companies"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def is_accessible_by(self, plan: str) -> bool:
        """Whether a user on the given subscription plan can access this entry."""
        from apps.subscriptions.plans import has_skills

        if self.kind == self.Kind.SKILL:
            return has_skills(plan)
        return plan != "free" or self.is_free


class Role(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="roles",
    )
    title = models.CharField(max_length=100)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return f"{self.company.name} — {self.title}"


class Round(models.Model):
    class RoundType(models.TextChoices):
        TECHNICAL = "technical", "Technical"
        BEHAVIORAL = "behavioral", "Behavioral"
        SYSTEM_DESIGN = "system_design", "System Design"
        HR = "hr", "HR"

    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="rounds",
    )
    title = models.CharField(max_length=100)
    order = models.IntegerField(default=0)
    round_type = models.CharField(
        max_length=20,
        choices=RoundType.choices,
        default=RoundType.TECHNICAL,
        help_text="Drives the badge/styling on the frontend round picker.",
    )

    class Meta:
        ordering = ["order"]

    @classmethod
    def infer_round_type(cls, title: str) -> str:
        """Best-effort guess of round_type from a human-written round title,
        used by the seed commands so existing seed data doesn't need every
        entry hand-annotated."""
        t = title.lower()
        if "hr" in t or "leadership" in t or "googleyness" in t:
            return cls.RoundType.HR
        if "system design" in t or "design" in t or "architecture" in t or "scalab" in t:
            return cls.RoundType.SYSTEM_DESIGN
        if "behav" in t or "culture" in t or "manager" in t:
            return cls.RoundType.BEHAVIORAL
        return cls.RoundType.TECHNICAL

    def __str__(self) -> str:
        return f"{self.role} / {self.title}"


class InterviewQuestion(models.Model):
    QUESTION_TYPES = [
        ("mcq", "MCQ"),
        ("coding", "Coding"),
        ("behavioral", "Behavioral"),
    ]

    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    ideal_answer = models.TextField(blank=True)
    source_url = models.CharField(max_length=255, blank=True)
    generated_by_ai = models.BooleanField(
        default=False,
        help_text="True if sourced automatically from the web via AI, rather than entered by an admin.",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"[{self.question_type}] {self.question_text[:60]}"