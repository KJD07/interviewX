from datetime import date, datetime
from decimal import Decimal

from django import forms
from django.contrib import admin, messages as django_messages
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.admin.utils import get_deleted_objects, label_for_field
from django.contrib.auth import get_user_model
from django.db import models
from django.http import Http404
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

LOOKUP_RESULT_LIMIT = 20
FK_PRELOAD_LIMIT = 50


def _model_admin(app_label, model_name):
    for model, model_admin in admin.site._registry.items():
        if model._meta.app_label == app_label and model._meta.model_name == model_name:
            return model, model_admin
    raise Http404("Admin model not found")


def _json_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, models.Model):
        return value.pk
    return value


def _check_permission(model_admin, request, kind):
    """kind is one of view/add/change/delete. Raises PermissionDenied (403)
    if the current staff user lacks it, mirroring Django admin's own
    has_*_permission checks."""
    checker = getattr(model_admin, f"has_{kind}_permission")
    if not checker(request):
        raise PermissionDenied(f"You do not have permission to {kind} this object.")


def _permission_flags(model_admin, request):
    return {
        "can_view": model_admin.has_view_permission(request),
        "can_add": model_admin.has_add_permission(request),
        "can_change": model_admin.has_change_permission(request),
        "can_delete": model_admin.has_delete_permission(request),
    }


def _is_user_model(model):
    return model is get_user_model()


def _expand_split_datetime(form_class, data):
    """Django admin renders every plain DateTimeField with a SplitDateTimeField
    (two sub-inputs, posted as "<name>_0"/"<name>_1"). The frontend sends a
    single ISO string per field (matching how _serialize_object emits it) —
    split it into the two sub-keys the form actually expects before
    validating, for every model with an editable DateTimeField, not just User."""
    has_split = any(isinstance(field, forms.SplitDateTimeField) for field in form_class.base_fields.values())
    if not has_split:
        return data
    from django.utils import timezone as dj_tz
    from django.utils.dateparse import parse_datetime

    data = dict(data)
    for name, field in form_class.base_fields.items():
        if not isinstance(field, forms.SplitDateTimeField) or name not in data:
            continue
        raw = data.pop(name)
        if not raw:
            data[f"{name}_0"] = ""
            data[f"{name}_1"] = ""
            continue
        dt = parse_datetime(raw) if isinstance(raw, str) else None
        if dt is None:
            data[f"{name}_0"] = ""
            data[f"{name}_1"] = ""
            continue
        if dj_tz.is_aware(dt):
            dt = dj_tz.localtime(dt)
        data[f"{name}_0"] = dt.strftime("%Y-%m-%d")
        data[f"{name}_1"] = dt.strftime("%H:%M:%S")
    return data


def _flatten_deleted(nested, out=None, depth=0):
    """get_deleted_objects returns a nested list (for <ul> display) —
    flatten it to a flat list of strings, indenting to preserve structure."""
    if out is None:
        out = []
    for item in nested:
        if isinstance(item, list):
            _flatten_deleted(item, out, depth + 1)
        else:
            out.append(("  " * depth) + str(item))
    return out


def _fk_options(model_field, limit=FK_PRELOAD_LIMIT):
    return [{"value": obj.pk, "label": str(obj)} for obj in model_field.remote_field.model.objects.all()[:limit]]


def _field_metadata(model_admin, model, form, request):
    readonly = list(model_admin.get_readonly_fields(request))
    fields = []
    seen = set()

    for name, field in form.base_fields.items():
        seen.add(name)
        model_field = next((candidate for candidate in model._meta.get_fields() if candidate.name == name), None)
        choices = [{"value": str(value), "label": label} for value, label in (getattr(field, "choices", None) or [])]
        options = []
        is_m2m = False
        if isinstance(model_field, (models.ForeignKey, models.OneToOneField)):
            options = _fk_options(model_field)
        elif getattr(model_field, "many_to_many", False):
            is_m2m = True
            options = _fk_options(model_field)
        field_type = field.__class__.__name__
        # User.password is a raw hash — the frontend renders a dedicated
        # "set new password" control for it instead of the hash text field.
        is_password = _is_user_model(model) and name == "password"
        fields.append({
            "name": name,
            "label": field.label or name.replace("_", " ").title(),
            "type": "PasswordField" if is_password else ("ManyToManyField" if is_m2m else field_type),
            "required": field.required,
            "readonly": name in readonly or model_field is None,
            "help_text": field.help_text,
            "choices": choices,
            "options": options,
            "is_m2m": is_m2m,
        })

    if _is_user_model(model):
        # UserCreationForm (add) exposes password1/password2; UserChangeForm
        # (edit) exposes a single read-only-hash "password" field. Collapse
        # whichever is present into one synthetic write-only "password"
        # field so the frontend always renders (and posts) just one control —
        # see AdminModelView.post/patch for how "password" is consumed.
        password_names = {"password", "password1", "password2"}
        insert_at = next((i for i, f in enumerate(fields) if f["name"] in password_names), len(fields))
        fields = [f for f in fields if f["name"] not in password_names]
        fields.insert(insert_at, {
            "name": "password",
            "label": "Password",
            "type": "PasswordField",
            "required": False,
            "readonly": False,
            "help_text": "Leave blank to keep the current password.",
            "choices": [],
            "options": [],
            "is_m2m": False,
        })
        seen |= password_names

    for name in readonly:
        if name in seen:
            continue
        model_field = next((candidate for candidate in model._meta.get_fields() if candidate.name == name), None)
        try:
            label = label_for_field(name, model, model_admin)
        except Exception:
            label = name.replace("_", " ").title()
        field_type = "JSONField" if isinstance(model_field, models.JSONField) else "ReadonlyField"
        fields.append({
            "name": name,
            "label": label.replace("_", " ").title() if label == label.lower() else label,
            "type": field_type,
            "required": False,
            "readonly": True,
            "help_text": "",
            "choices": [],
            "options": [],
            "is_m2m": False,
        })
        seen.add(name)

    return fields


def _fieldsets_metadata(model_admin, known_field_names):
    fieldsets = getattr(model_admin, "fieldsets", None)
    if not fieldsets:
        return []
    result = []
    for title, opts in fieldsets:
        names = [name for name in opts.get("fields", []) if name in known_field_names]
        if names:
            result.append({"title": title or "", "field_names": names})
    return result


def _inline_metadata(model, model_admin):
    inlines = []
    for inline_cls in getattr(model_admin, "inlines", []) or []:
        child_model = inline_cls.model
        # Only expose inlines whose child model is independently reachable
        # through this same generic API (has its own ModelAdmin registration).
        if child_model not in admin.site._registry:
            continue
        fk_name = getattr(inline_cls, "fk_name", None)
        if not fk_name:
            for field in child_model._meta.get_fields():
                if isinstance(field, models.ForeignKey) and (
                    field.remote_field.model == model or issubclass(model, field.remote_field.model)
                ):
                    fk_name = field.name
                    break
        if not fk_name:
            continue
        inlines.append({
            "app_label": child_model._meta.app_label,
            "model_name": child_model._meta.model_name,
            "label": child_model._meta.verbose_name_plural.title(),
            "fk_name": fk_name,
        })
    return inlines


def _serialize_object(model, obj, model_admin):
    result = {"id": obj.pk}
    for field in model._meta.get_fields():
        if not getattr(field, "concrete", False):
            continue
        if field.many_to_many:
            related = list(getattr(obj, field.name).all())
            result[field.name] = [item.pk for item in related]
            result[f"{field.name}_label"] = ", ".join(str(item) for item in related)
            continue
        value = getattr(obj, field.name, None)
        result[field.name] = _json_value(value)
        if isinstance(field, (models.ForeignKey, models.OneToOneField)):
            result[f"{field.name}_label"] = str(value) if value else ""
    return result


def _list_filter_metadata(model_admin, model, request):
    result = []
    for entry in getattr(model_admin, "list_filter", []) or []:
        if not isinstance(entry, str):
            # Custom SimpleListFilter classes / (field, FilterClass) tuples
            # aren't generically introspectable — skip rather than guess.
            continue
        field_name = entry
        model_field = None
        try:
            model_field = model._meta.get_field(field_name.split("__")[0])
        except Exception:
            pass
        choices = []
        if model_field is not None:
            if isinstance(model_field, (models.ForeignKey, models.OneToOneField)):
                choices = [{"value": obj.pk, "label": str(obj)} for obj in model_field.remote_field.model.objects.all()[:200]]
            elif getattr(model_field, "choices", None):
                choices = [{"value": str(value), "label": label} for value, label in model_field.choices]
            elif isinstance(model_field, models.BooleanField):
                choices = [{"value": "1", "label": "Yes"}, {"value": "0", "label": "No"}]
        result.append({"name": field_name, "label": field_name.replace("_", " ").replace("__", " ").title(), "choices": choices})
    return result


class AdminSchemaView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        groups = {}
        for model, model_admin in admin.site._registry.items():
            if not model_admin.has_view_permission(request):
                continue
            # Pass an (unsaved) instance so ModelAdmin subclasses that use a
            # different form for add vs. change (UserAdmin: UserCreationForm
            # vs. UserChangeForm) report the fuller change-form field set —
            # the one an edit actually uses. Every other model's add_form
            # and form are identical, so this is a no-op for them.
            form = model_admin.get_form(request, obj=model())
            app_label = model._meta.app_label
            field_meta = _field_metadata(model_admin, model, form, request)
            known_names = {f["name"] for f in field_meta}
            groups.setdefault(app_label, []).append({
                "app_label": app_label,
                "model": model._meta.model_name,
                "label": model._meta.verbose_name_plural.title(),
                "fields": field_meta,
                "list_display": [str(item) for item in model_admin.get_list_display(request)],
                "search_fields": list(model_admin.search_fields),
                "list_filter": _list_filter_metadata(model_admin, model, request),
                "fieldsets": _fieldsets_metadata(model_admin, known_names),
                "inlines": _inline_metadata(model, model_admin),
                "actions": [
                    {"name": name, "label": str(action[2])}
                    for name, action in model_admin.get_actions(request).items()
                ],
                **_permission_flags(model_admin, request),
            })
        return Response({"groups": [{"app_label": key, "models": value} for key, value in groups.items()]})


class AdminModelView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, app_label, model_name, object_id=None):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "view")
        queryset = model_admin.get_queryset(request)
        if object_id is not None:
            obj = queryset.filter(pk=object_id).first()
            if obj is None:
                raise Http404("Object not found")
            return Response({"object": _serialize_object(model, obj, model_admin)})

        search = request.query_params.get("search", "").strip()
        if search and model_admin.search_fields:
            from django.db.models import Q
            query = Q()
            for field_name in model_admin.search_fields:
                query |= Q(**{f"{field_name}__icontains": search})
            queryset = queryset.filter(query)

        list_filter_names = {
            entry if isinstance(entry, str) else None
            for entry in (getattr(model_admin, "list_filter", []) or [])
        }
        list_filter_names.discard(None)
        for param, value in request.query_params.items():
            if not param.startswith("filter_") or value == "":
                continue
            field_name = param[len("filter_"):]
            if field_name not in list_filter_names:
                continue
            queryset = queryset.filter(**{field_name: value})

        # Separate, unrestricted-by-list_filter mechanism used only to fetch
        # one parent's inline children (e.g. ?company=<id> for Role) — safe
        # since it only ever matches a real FK/O2O field name on this model,
        # not arbitrary lookups.
        fk_field_names = {
            field.name for field in model._meta.get_fields()
            if isinstance(field, (models.ForeignKey, models.OneToOneField))
        }
        for field_name in fk_field_names:
            value = request.query_params.get(field_name)
            if value:
                queryset = queryset.filter(**{field_name: value})

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        page_size = 25
        total = queryset.count()
        objects = queryset[(page - 1) * page_size: page * page_size]
        return Response({
            "results": [_serialize_object(model, obj, model_admin) for obj in objects],
            "page": page,
            "page_size": page_size,
            "total": total,
        })

    def post(self, request, app_label, model_name):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "add")
        data = request.data
        if _is_user_model(model):
            data = dict(data)
            password_value = data.pop("password", None)
            if not password_value:
                return Response({"errors": {"password": ["Password is required."]}}, status=400)
            # UserCreationForm (the add_form Django's UserAdmin uses) expects
            # password1/password2 and hashes internally via set_password() in
            # its own save() — feed it the single value from both sides.
            data["password1"] = password_value
            data["password2"] = password_value
        form_class = model_admin.get_form(request)
        data = _expand_split_datetime(form_class, data)
        form = form_class(data=data)
        if not form.is_valid():
            return Response({"errors": form.errors}, status=400)
        obj = form.save(commit=False)
        obj.save()
        if hasattr(form, "save_m2m"):
            form.save_m2m()
        return Response({"object": _serialize_object(model, obj, model_admin)}, status=201)

    def patch(self, request, app_label, model_name, object_id):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "change")
        obj = model_admin.get_queryset(request).filter(pk=object_id).first()
        if obj is None:
            raise Http404("Object not found")
        data = request.data
        password_value = None
        if _is_user_model(model) and data.get("password"):
            data = dict(data)
            password_value = data.pop("password")
        elif _is_user_model(model):
            data = dict(data)
            data.pop("password", None)
        form_class = model_admin.get_form(request, obj=obj)
        data = _expand_split_datetime(form_class, data)
        form = form_class(data=data, instance=obj)
        if not form.is_valid():
            return Response({"errors": form.errors}, status=400)
        obj = form.save(commit=False)
        if password_value:
            obj.set_password(password_value)
        obj.save()
        if hasattr(form, "save_m2m"):
            form.save_m2m()
        return Response({"object": _serialize_object(model, obj, model_admin)})

    def delete(self, request, app_label, model_name, object_id):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "delete")
        obj = model_admin.get_queryset(request).filter(pk=object_id).first()
        if obj is None:
            raise Http404("Object not found")

        if request.query_params.get("dry_run") == "1":
            nested, model_count, perms_needed, protected = get_deleted_objects([obj], request, admin.site)
            return Response({
                "objects": _flatten_deleted(nested)[:100],
                "model_count": {str(model_label): count for model_label, count in model_count.items()},
                "protected": [str(item) for item in protected],
                "perms_needed": [str(item) for item in perms_needed],
            })

        obj.delete()
        return Response(status=204)


class AdminDeletePreviewView(APIView):
    """Standalone cascade-delete precheck, equivalent to
    AdminModelView.delete(..., dry_run=1) but reachable without sending an
    actual DELETE, for the frontend's confirm() dialog."""
    permission_classes = [IsAdminUser]

    def get(self, request, app_label, model_name, object_id):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "delete")
        obj = model_admin.get_queryset(request).filter(pk=object_id).first()
        if obj is None:
            raise Http404("Object not found")
        nested, model_count, perms_needed, protected = get_deleted_objects([obj], request, admin.site)
        return Response({
            "objects": _flatten_deleted(nested)[:100],
            "model_count": {str(model_label): count for model_label, count in model_count.items()},
            "protected": [str(item) for item in protected],
            "perms_needed": [str(item) for item in perms_needed],
        })


class AdminLookupView(APIView):
    """Lightweight type-ahead for FK/M2M pickers — avoids preloading up to
    500 rows per FK on every schema load."""
    permission_classes = [IsAdminUser]

    def get(self, request, app_label, model_name):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "view")
        query = request.query_params.get("q", "").strip()
        queryset = model_admin.get_queryset(request)
        if query and model_admin.search_fields:
            from django.db.models import Q
            filters = Q()
            for field_name in model_admin.search_fields:
                filters |= Q(**{f"{field_name}__icontains": query})
            queryset = queryset.filter(filters)
        results = [{"value": obj.pk, "label": str(obj)} for obj in queryset[:LOOKUP_RESULT_LIMIT]]
        return Response({"results": results})


class AdminActionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, app_label, model_name, action_name):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "change")
        action = model_admin.get_actions(request).get(action_name)
        if action is None:
            raise Http404("Admin action not found")
        queryset = model_admin.get_queryset(request).filter(pk__in=request.data.get("ids", []))
        count = queryset.count()
        action[0](request, queryset)

        texts = []
        try:
            for message in django_messages.get_messages(request._request):
                texts.append(str(message))
        except Exception:
            pass
        detail = "\n".join(texts) if texts else f"{count} object(s) processed."
        return Response({"detail": detail})


class AdminHistoryView(APIView):
    """django.contrib.admin's LogEntry trail for one object — the "History"
    button real Django admin shows on the change form."""
    permission_classes = [IsAdminUser]

    def get(self, request, app_label, model_name, object_id):
        model, model_admin = _model_admin(app_label, model_name)
        _check_permission(model_admin, request, "view")
        from django.contrib.contenttypes.models import ContentType

        content_type = ContentType.objects.get_for_model(model)
        entries = LogEntry.objects.filter(
            content_type=content_type, object_id=str(object_id)
        ).select_related("user").order_by("-action_time")[:100]

        action_labels = {ADDITION: "Added", CHANGE: "Changed", DELETION: "Deleted"}
        return Response({
            "entries": [
                {
                    "id": entry.pk,
                    "timestamp": entry.action_time.isoformat(),
                    "user": str(entry.user) if entry.user_id else "",
                    "action": action_labels.get(entry.action_flag, "Unknown"),
                    "change_message": entry.get_change_message(),
                }
                for entry in entries
            ]
        })


class AdminUploadSpreadsheetView(APIView):
    """POST multipart {file}: bulk-imports Company/Role/Round/InterviewQuestion
    rows, reusing the exact logic behind CompanyAdmin.upload_spreadsheet_view."""
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        from apps.companies.imports import SpreadsheetImportError, import_spreadsheet

        _, model_admin = _model_admin("companies", "company")
        _check_permission(model_admin, request, "change")

        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response({"error": "No file uploaded."}, status=400)
        try:
            result = import_spreadsheet(uploaded)
        except SpreadsheetImportError as exc:
            return Response({"error": str(exc)}, status=400)

        message = (
            f"Imported {result.questions_created} question(s) "
            f"({result.companies_created} new companies, {result.roles_created} new roles, "
            f"{result.rounds_created} new rounds) out of {result.rows_seen} row(s) seen. "
            f"Skipped {result.rows_skipped} incomplete row(s) and "
            f"{result.questions_skipped_duplicate} already-imported question(s)."
        )
        if result.skipped_examples:
            message += " Examples: " + "; ".join(result.skipped_examples)
        return Response({"detail": message})


class AdminUploadSponsorshipEmailsView(APIView):
    """POST multipart {file} against a specific SponsorshipCampaign id, reusing
    the exact logic behind SponsorshipCampaignAdmin.upload_emails_view."""
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, campaign_id):
        from core.spreadsheet import SpreadsheetError

        from apps.subscriptions.imports import import_sponsorship_emails
        from apps.subscriptions.models import SponsorshipCampaign

        _, model_admin = _model_admin("subscriptions", "sponsorshipcampaign")
        _check_permission(model_admin, request, "change")

        campaign = SponsorshipCampaign.objects.filter(pk=campaign_id).first()
        if campaign is None:
            raise Http404("Campaign not found")

        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response({"error": "No file uploaded."}, status=400)
        try:
            result = import_sponsorship_emails(campaign, uploaded)
        except SpreadsheetError as exc:
            return Response({"error": str(exc)}, status=400)

        message = (
            f"Added {result.members_created} email(s) to “{campaign.name}” "
            f"out of {result.rows_seen} row(s) seen. "
            f"Skipped {result.rows_skipped} unusable row(s) and "
            f"{result.members_skipped_duplicate} already-covered email(s)."
        )
        if result.skipped_examples:
            message += " Examples: " + "; ".join(result.skipped_examples)
        return Response({"detail": message})
