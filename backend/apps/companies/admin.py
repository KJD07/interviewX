from django.contrib import admin, messages

from core.question_sourcing import QuestionSourcingError, source_questions_for_round

from .models import Company, InterviewQuestion, Role, Round


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
    list_display = ("question_type", "round", "question_text", "generated_by_ai")
    list_filter = ("question_type", "generated_by_ai", "round__role__company")
    search_fields = ("question_text",)