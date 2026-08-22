from datetime import date, datetime
from decimal import Decimal

from django.contrib import admin
from django.db import models
from django.http import Http404
from django.utils.dateformat import format as date_format
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView


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


def _field_metadata(model_admin, model, form, request):
    readonly = set(model_admin.get_readonly_fields(None))
    fields = []
    for name, field in form.base_fields.items():
        model_field = next((candidate for candidate in model._meta.get_fields() if candidate.name == name), None)
        choices = [{"value": str(value), "label": label} for value, label in (getattr(field, "choices", None) or [])]
        options = []
        if isinstance(model_field, (models.ForeignKey, models.OneToOneField)):
            options = [{"value": obj.pk, "label": str(obj)} for obj in model_field.remote_field.model.objects.all()[:500]]
        fields.append({
            "name": name,
            "label": field.label or name.replace("_", " ").title(),
            "type": field.__class__.__name__,
            "required": field.required,
                "readonly": name in readonly or model_field is None,
            "help_text": field.help_text,
            "choices": choices,
            "options": options,
        })
    return fields


def _serialize_object(model, obj, model_admin):
    result = {"id": obj.pk}
    for field in model._meta.get_fields():
        if not getattr(field, "concrete", False) or field.many_to_many:
            continue
        value = getattr(obj, field.name, None)
        result[field.name] = _json_value(value)
        if isinstance(field, (models.ForeignKey, models.OneToOneField)):
            result[f"{field.name}_label"] = str(value) if value else ""
    return result


class AdminSchemaView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        groups = {}
        for model, model_admin in admin.site._registry.items():
            form = model_admin.get_form(request)
            app_label = model._meta.app_label
            groups.setdefault(app_label, []).append({
                "app_label": app_label,
                "model": model._meta.model_name,
                "label": model._meta.verbose_name_plural.title(),
                "fields": _field_metadata(model_admin, model, form, request),
                "list_display": [str(item) for item in model_admin.get_list_display(request)],
                "search_fields": list(model_admin.search_fields),
                "actions": [
                    {"name": name, "label": str(action[2])}
                    for name, action in model_admin.get_actions(request).items()
                ],
            })
        return Response({"groups": [{"app_label": key, "models": value} for key, value in groups.items()]})


class AdminModelView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, app_label, model_name, object_id=None):
        model, model_admin = _model_admin(app_label, model_name)
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
        form = model_admin.get_form(request)(data=request.data)
        if not form.is_valid():
            return Response({"errors": form.errors}, status=400)
        obj = form.save()
        return Response({"object": _serialize_object(model, obj, model_admin)}, status=201)

    def patch(self, request, app_label, model_name, object_id):
        model, model_admin = _model_admin(app_label, model_name)
        obj = model_admin.get_queryset(request).filter(pk=object_id).first()
        if obj is None:
            raise Http404("Object not found")
        form = model_admin.get_form(request)(data=request.data, instance=obj)
        if not form.is_valid():
            return Response({"errors": form.errors}, status=400)
        obj = form.save()
        return Response({"object": _serialize_object(model, obj, model_admin)})

    def delete(self, request, app_label, model_name, object_id):
        model, model_admin = _model_admin(app_label, model_name)
        obj = model_admin.get_queryset(request).filter(pk=object_id).first()
        if obj is None:
            raise Http404("Object not found")
        obj.delete()
        return Response(status=204)


class AdminActionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, app_label, model_name, action_name):
        model, model_admin = _model_admin(app_label, model_name)
        action = model_admin.get_actions(request).get(action_name)
        if action is None:
            raise Http404("Admin action not found")
        queryset = model_admin.get_queryset(request).filter(pk__in=request.data.get("ids", []))
        action[0](request, queryset)
        return Response({"detail": f"{queryset.count()} object(s) processed."})