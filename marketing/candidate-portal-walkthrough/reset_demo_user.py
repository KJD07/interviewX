# Run with: manage.py shell < reset_demo_user.py — recreates the walkthrough's demo candidate from scratch.
from django.contrib.auth import get_user_model

U = get_user_model()
U.objects.filter(username="aarav.sharma@example.com").delete()
u = U.objects.create(username="aarav.sharma@example.com", email="aarav.sharma@example.com",
                     first_name="Aarav", last_name="Sharma", is_email_verified=True)
u.set_password("DemoPass#2026")
u.save()
print("demo user", u.id)
