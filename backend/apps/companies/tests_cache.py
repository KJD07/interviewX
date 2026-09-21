from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from core.read_cache import (
    company_list_cache_key,
    get_company_catalog_version,
    invalidate_company_catalog_cache,
)

from .models import Company

User = get_user_model()


class CompanyListCacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="reader",
            email="reader@test.com",
            password="pw12345!",
        )
        Company.objects.create(
            name="Free Co",
            tone_style="formal_strict",
            is_free=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_company_list_served_from_cache_on_second_request(self):
        with patch.object(Company.objects, "filter", wraps=Company.objects.filter) as company_filter:
            res1 = self.client.get("/api/companies/")
            self.assertEqual(res1.status_code, 200)
            self.assertEqual(len(res1.json()), 1)
            calls_after_first = company_filter.call_count

            res2 = self.client.get("/api/companies/")
            self.assertEqual(res2.status_code, 200)
            self.assertEqual(res2.json(), res1.json())
            self.assertEqual(company_filter.call_count, calls_after_first)

    def test_catalog_invalidation_bumps_version_and_refreshes_list(self):
        res1 = self.client.get("/api/companies/")
        self.assertEqual(len(res1.json()), 1)
        key_before = company_list_cache_key(Company.Kind.COMPANY, "free")
        self.assertIsNotNone(cache.get(key_before))

        Company.objects.create(name="Another Free", tone_style="formal_strict", is_free=True)
        invalidate_company_catalog_cache()
        self.assertNotEqual(get_company_catalog_version(), 0)
        self.assertIsNone(cache.get(key_before))

        res2 = self.client.get("/api/companies/")
        self.assertEqual(len(res2.json()), 2)
