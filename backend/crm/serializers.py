from rest_framework import serializers

from .models import Customer, CustomerContact, CustomerInteraction


class CustomerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerContact
        fields = [
            "id",
            "customer",
            "name",
            "phone",
            "position",
        ]
        read_only_fields = ["id"]


class CustomerInteractionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = CustomerInteraction
        fields = [
            "id",
            "customer",
            "user",
            "type",
            "type_display",
            "content",
            "next_follow_up",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "type_display"]


class CustomerSerializer(serializers.ModelSerializer):
    contacts = CustomerContactSerializer(many=True, read_only=True)
    interactions = CustomerInteractionSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "address",
            "city",
            "source",
            "assigned_to",
            "contacts",
            "interactions",
            "created_at",
        ]
        read_only_fields = ["id", "contacts", "interactions", "created_at"]
