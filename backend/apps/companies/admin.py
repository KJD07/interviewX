from django.contrib import admin

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


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "tone_style")
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


@admin.register(InterviewQuestion)
class InterviewQuestionAdmin(admin.ModelAdmin):
    list_display = ("question_type", "round", "question_text")
    list_filter = ("question_type", "round__role__company")
    search_fields = ("question_text",)
