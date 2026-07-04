from rest_framework import serializers

from .models import Customer, CustomerContact, CustomerInteraction, CustomerTag


class CustomerTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerTag
        fields = ["id", "name", "color"]
        read_only_fields = ["id"]


class CustomerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerContact
        fields = ["id", "customer", "name", "phone", "email", "position"]
        read_only_fields = ["id"]


class CustomerInteractionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    result_display = serializers.CharField(source="get_result_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = CustomerInteraction
        fields = [
            "id",
            "customer",
            "created_by",
            "created_by_name",
            "type",
            "type_display",
            "content",
            "result",
            "result_display",
            "next_follow_up",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "type_display", "result_display", "created_by_name"]


class CustomerSerializer(serializers.ModelSerializer):
    contacts = CustomerContactSerializer(many=True, read_only=True)
    interactions = CustomerInteractionSerializer(many=True, read_only=True)
    tags = CustomerTagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=CustomerTag.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source="tags",
    )
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "company",
            "name",
            "phone",
            "email",
            "address",
            "city",
            "source",
            "source_display",
            "status",
            "status_display",
            "tags",
            "tag_ids",
            "assigned_to",
            "assigned_to_name",
            "notes",
            "contacts",
            "interactions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "company", "contacts", "interactions", "tags",
            "assigned_to_name", "status_display", "source_display",
            "created_at", "updated_at",
        ]
