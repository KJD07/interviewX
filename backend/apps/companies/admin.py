from django.contrib import admin, messages
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.subscriptions.plans import PAID_PLANS
from core.question_sourcing import QuestionSourcingError, source_questions_for_round

from .models import Company, InterviewQuestion, Role, Round

# Bonus interview credits granted once per real-interview-report submission
# whose candidate-supplied questions are verified (approved), and only if
# the submitting user currently holds a paid plan. Kept separate from
# apps.interviews.admin.REAL_REPORT_REWARD_CREDITS, which rewards the report
# text itself unconditionally — this rewards the *questions* specifically.
QUESTION_SUBMISSION_REWARD_CREDITS = 5


class RoleInline(admin.TabularInline):
    model = Role
    extra = 1
    show_change_link = True


class RoundInline(admin.TabularInline):
    model = Round
    extra = 1
    show_change_link = True


class InterviewQuestionInline(admin.TabularInline):
    model = InterviewQuestion
    extra = 1
    fields = ("question_text", "question_type", "ideal_answer", "source_url", "generated_by_ai")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "category", "tone_style", "is_free")
    list_filter = ("kind", "category")
    search_fields = ("name",)
    inlines = [RoleInline]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("title", "company")
    list_filter = ("company",)
    search_fields = ("title",)
    inlines = [RoundInline]


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ("title", "role", "order")
    list_filter = ("role__company",)
    inlines = [InterviewQuestionInline]
    actions = ["generate_questions_via_ai"]

    @admin.action(description="Generate questions via AI (replaces previously AI-sourced ones)")
    def generate_questions_via_ai(self, request, queryset):
        for round_obj in queryset.select_related("role__company"):
            try:
                sourced = source_questions_for_round(
                    company_name=round_obj.role.company.name,
                    role_title=round_obj.role.title,
                    round_title=round_obj.title,
                )
            except QuestionSourcingError as exc:
                self.message_user(
                    request, f"{round_obj}: {exc}", level=messages.ERROR
                )
                continue

            round_obj.questions.filter(generated_by_ai=True).delete()
            InterviewQuestion.objects.bulk_create(
                [
                    InterviewQuestion(
                        round=round_obj,
                        question_text=q.question_text,
                        question_type=q.question_type,
                        ideal_answer=q.ideal_answer,
                        source_url=q.source_url,
                        generated_by_ai=True,
                    )
                    for q in sourced
                ]
            )
            self.message_user(
                request, f"{round_obj}: sourced {len(sourced)} questions.", level=messages.SUCCESS
            )


@admin.register(InterviewQuestion)
class InterviewQuestionAdmin(admin.ModelAdmin):
    list_display = (
        "question_type", "round", "question_text", "status",
        "submitted_by", "generated_by_ai",
    )
    list_filter = ("status", "question_type", "generated_by_ai", "round__role__company")
    search_fields = (
        "question_text", "submitted_by__username", "submitted_by__email",
        "submitted_company_name", "submitted_role_title",
    )
    actions = ["approve_questions", "reject_questions"]

    @admin.action(
        description=(
            f"Approve selected questions (verified candidate submissions grant "
            f"{QUESTION_SUBMISSION_REWARD_CREDITS} bonus interviews once per "
            f"report, paid-plan users only)"
        )
    )
    def approve_questions(self, request, queryset):
        # Import here (not at module scope) to avoid a companies<->interviews
        # import cycle at app-loading time.
        from apps.interviews.models import RealInterviewReport

        eligible = queryset.exclude(status=InterviewQuestion.Status.APPROVED)

        # Reward once per distinct submission (RealInterviewReport) that had
        # a question just verified — never for admin/AI-sourced rows, which
        # have no source_report, and never twice for the same report.
        # Must be captured BEFORE the update() below, since that flips these
        # same rows to APPROVED and would make this query return nothing.
        report_ids = list(
            eligible.exclude(source_report__isnull=True)
            .values_list("source_report_id", flat=True).distinct()
        )

        approved_count = eligible.update(status=InterviewQuestion.Status.APPROVED)

        rewarded = 0
        skipped_plan = 0
        with transaction.atomic():
            reports = (
                RealInterviewReport.objects.select_for_update()
                .filter(id__in=report_ids, questions_reward_granted_at__isnull=True)
                .select_related("user")
            )
            for report in reports:
                user = report.user
                user.sync_subscription_state()
                user.save()
                if user.subscription_plan not in PAID_PLANS:
                    skipped_plan += 1
                    continue
                type(user).objects.filter(pk=user.pk).update(
                    bonus_interviews=F("bonus_interviews") + QUESTION_SUBMISSION_REWARD_CREDITS
                )
                report.questions_reward_granted_at = timezone.now()
                report.save(update_fields=["questions_reward_granted_at"])
                rewarded += 1

        message = (
            f"Approved {approved_count} question(s); rewarded {rewarded} submission(s) "
            f"with {QUESTION_SUBMISSION_REWARD_CREDITS} bonus interviews each."
        )
        if skipped_plan:
            message += f" Skipped {skipped_plan} (submitter is not currently on a paid plan)."
        self.message_user(request, message)

    @admin.action(description="Reject selected questions")
    def reject_questions(self, request, queryset):
        updated = queryset.exclude(status=InterviewQuestion.Status.REJECTED).update(
            status=InterviewQuestion.Status.REJECTED
        )
        self.message_user(request, f"Rejected {updated} question(s).")