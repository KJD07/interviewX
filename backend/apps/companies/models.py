from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=100)
    tone_style = models.CharField(
        max_length=50,
        help_text='e.g. "formal_strict", "casual_friendly"',
    )
    description = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Companies"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


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
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="rounds",
    )
    title = models.CharField(max_length=100)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

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