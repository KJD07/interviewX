from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from core.spreadsheet import SpreadsheetError

from .imports import import_sponsorship_emails
from .models import SponsorshipCampaign, SponsorshipMember

User = get_user_model()


def _csv(body: str, name: str = "emails.csv") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, body.encode("utf-8"), content_type="text/csv")


from core.payu import paise_to_amount_str, payment_request_hash, payment_response_hash


class PayUHashTests(TestCase):
    def test_paise_to_amount_str(self):
        self.assertEqual(paise_to_amount_str(19900), "199.00")
        self.assertEqual(paise_to_amount_str(9900), "99.00")

    def test_payment_request_hash_matches_payu_docs_example_shape(self):
        digest = payment_request_hash(
            key="gtKFFx",
            txnid="123456789",
            amount="10.00",
            productinfo="Test Product",
            firstname="John",
            email="john@example.com",
            salt="eCwWELxi",
        )
        self.assertEqual(len(digest), 128)

    def test_payment_response_hash_is_deterministic(self):
        kwargs = {
            "salt": "eCwWELxi",
            "status": "success",
            "key": "gtKFFx",
            "txnid": "123456789",
            "amount": "10.00",
            "productinfo": "Test Product",
            "firstname": "John",
            "email": "john@example.com",
        }
        self.assertEqual(
            payment_response_hash(**kwargs),
            payment_response_hash(**kwargs),
        )


class SponsorshipEmailImportTests(TestCase):
    """Covers the admin 'Upload emails' spreadsheet import that populates a
    campaign's explicitly covered email list."""

    def setUp(self):
        self.campaign = SponsorshipCampaign.objects.create(
            name="Thapar toppers",
            email_domain="",
            granted_plan="premium",
            interview_limit=20,
            cycle_days=30,
            sponsor_covers_until=timezone.now() + timedelta(days=30),
        )

    def test_imports_emails_from_csv(self):
        result = import_sponsorship_emails(
            self.campaign, _csv("Email\na@thapar.edu\nb@gmail.com\n")
        )

        self.assertEqual(result.members_created, 2)
        self.assertEqual(result.rows_seen, 2)
        self.assertEqual(result.rows_skipped, 0)
        self.assertQuerySetEqual(
            self.campaign.members.values_list("email", flat=True),
            ["a@thapar.edu", "b@gmail.com"],
            transform=str,
        )

    def test_normalises_case_and_whitespace(self):
        import_sponsorship_emails(self.campaign, _csv("Email\n  A@Thapar.EDU  \n"))

        self.assertEqual(self.campaign.members.get().email, "a@thapar.edu")

    def test_skips_blank_and_malformed_rows_without_failing(self):
        result = import_sponsorship_emails(
            self.campaign, _csv("Email\na@thapar.edu\n\nnot-an-email\n,\n")
        )

        self.assertEqual(result.members_created, 1)
        self.assertEqual(result.rows_skipped, 2)
        self.assertTrue(result.skipped_examples)

    def test_reuploading_the_same_file_is_a_no_op(self):
        body = "Email\na@thapar.edu\nb@gmail.com\n"
        import_sponsorship_emails(self.campaign, _csv(body))
        result = import_sponsorship_emails(self.campaign, _csv(body))

        self.assertEqual(result.members_created, 0)
        self.assertEqual(result.members_skipped_duplicate, 2)
        self.assertEqual(self.campaign.members.count(), 2)

    def test_duplicate_rows_within_one_file_are_collapsed(self):
        result = import_sponsorship_emails(
            self.campaign, _csv("Email\na@thapar.edu\nA@THAPAR.EDU\n")
        )

        self.assertEqual(result.members_created, 1)
        self.assertEqual(result.members_skipped_duplicate, 1)

    def test_same_email_can_belong_to_two_campaigns(self):
        other = SponsorshipCampaign.objects.create(
            name="Other",
            email_domain="",
            granted_plan="pro",
            interview_limit=5,
            cycle_days=30,
            sponsor_covers_until=timezone.now() + timedelta(days=30),
        )
        import_sponsorship_emails(self.campaign, _csv("Email\na@thapar.edu\n"))
        import_sponsorship_emails(other, _csv("Email\na@thapar.edu\n"))

        self.assertEqual(SponsorshipMember.objects.filter(email="a@thapar.edu").count(), 2)

    def test_missing_email_column_aborts_the_whole_import(self):
        with self.assertRaises(SpreadsheetError):
            import_sponsorship_emails(self.campaign, _csv("Name\nSomeone\n"))

        self.assertEqual(self.campaign.members.count(), 0)

    def test_unsupported_file_type_is_rejected(self):
        with self.assertRaises(SpreadsheetError):
            import_sponsorship_emails(
                self.campaign, SimpleUploadedFile("emails.txt", b"Email\na@b.com\n")
            )

    def test_imports_emails_from_xlsx(self):
        import openpyxl

        wb = openpyxl.Workbook()
        sheet = wb.active
        sheet.append(["Email"])
        sheet.append(["a@thapar.edu"])
        sheet.append([None])
        sheet.append(["b@gmail.com"])
        buf = BytesIO()
        wb.save(buf)

        result = import_sponsorship_emails(
            self.campaign,
            SimpleUploadedFile("emails.xlsx", buf.getvalue()),
        )

        self.assertEqual(result.members_created, 2)


class SponsorshipCampaignModelTests(TestCase):
    def test_domain_is_normalised_and_optional(self):
        campaign = SponsorshipCampaign.objects.create(
            name="Thapar",
            email_domain="@Thapar.EDU ",
            granted_plan="pro",
            interview_limit=5,
            cycle_days=30,
            sponsor_covers_until=timezone.now() + timedelta(days=30),
        )
        self.assertEqual(campaign.email_domain, "thapar.edu")

        # Two campaigns may now share a domain — one blanket deal plus a
        # narrower list-based one for the same college.
        second = SponsorshipCampaign.objects.create(
            name="Thapar toppers",
            email_domain="thapar.edu",
            granted_plan="max",
            interview_limit=40,
            cycle_days=30,
            sponsor_covers_until=timezone.now() + timedelta(days=30),
        )
        self.assertNotEqual(campaign.pk, second.pk)


class SponsorshipAdminTests(TestCase):
    """Smoke coverage for the admin surface — the custom upload URL and the
    two templates aren't exercised by the importer tests above, so a typo in
    either would otherwise only show up in the browser."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="root", email="root@example.com", password="rootpass123"
        )
        self.client.force_login(self.admin)
        self.campaign = SponsorshipCampaign.objects.create(
            name="Thapar toppers",
            email_domain="",
            granted_plan="premium",
            interview_limit=20,
            cycle_days=30,
            sponsor_covers_until=timezone.now() + timedelta(days=30),
        )

    def _upload_url(self):
        return reverse(
            "admin:subscriptions_sponsorshipcampaign_upload_emails",
            args=[self.campaign.pk],
        )

    def test_campaign_change_page_offers_the_upload_link(self):
        resp = self.client.get(
            reverse("admin:subscriptions_sponsorshipcampaign_change", args=[self.campaign.pk])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Upload emails")
        self.assertContains(resp, self._upload_url())

    def test_campaign_changelist_renders(self):
        resp = self.client.get(reverse("admin:subscriptions_sponsorshipcampaign_changelist"))
        self.assertEqual(resp.status_code, 200)

    def test_member_changelist_renders(self):
        resp = self.client.get(reverse("admin:subscriptions_sponsorshipmember_changelist"))
        self.assertEqual(resp.status_code, 200)

    def test_upload_page_renders_and_import_reports_counts(self):
        self.assertEqual(self.client.get(self._upload_url()).status_code, 200)

        resp = self.client.post(
            self._upload_url(),
            {
                "file": SimpleUploadedFile(
                    "emails.csv", b"Email\na@thapar.edu\nbad\n", content_type="text/csv"
                )
            },
            follow=True,
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.campaign.members.count(), 1)
        self.assertContains(resp, "Added 1 email")

    def test_bad_file_type_reports_an_error_instead_of_500ing(self):
        resp = self.client.post(
            self._upload_url(),
            {"file": SimpleUploadedFile("emails.txt", b"Email\na@b.com\n")},
            follow=True,
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.campaign.members.count(), 0)
        self.assertContains(resp, "Unsupported file type")

    def test_companies_upload_page_still_works_after_the_reader_refactor(self):
        resp = self.client.get(reverse("admin:companies_company_upload_spreadsheet"))
        self.assertEqual(resp.status_code, 200)
