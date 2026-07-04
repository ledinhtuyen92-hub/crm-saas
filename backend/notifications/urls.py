from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="list"),
    path("unread-count/", views.unread_count, name="unread-count"),
    path("mark-all-read/", views.mark_all_read, name="mark-all-read"),
    path("<int:pk>/read/", views.NotificationMarkReadView.as_view(), name="mark-read"),
]
