"""Serializers for Clinical Insights API."""

from rest_framework import serializers
from common.models import ClinicalInsight


class ClinicalInsightSerializer(serializers.ModelSerializer):
    """Serializer for ClinicalInsight model."""
    
    class Meta:
        model = ClinicalInsight
        fields = [
            'id', 'session_type', 'pattern', 'recommendation',
            'confidence_score', 'usage_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'usage_count']


class ClinicalInsightCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ClinicalInsight with optional embedding."""
    
    embedding = serializers.ListField(
        child=serializers.FloatField(),
        required=False,
        write_only=True,
        help_text="Optional embedding vector for semantic search"
    )
    
    class Meta:
        model = ClinicalInsight
        fields = [
            'id', 'session_type', 'pattern', 'recommendation',
            'confidence_score', 'embedding'
        ]
        read_only_fields = ['id']


class ClinicalInsightStatsSerializer(serializers.Serializer):
    """Serializer for insights statistics."""
    
    total_sessions_learned = serializers.IntegerField()
    experience_level = serializers.CharField()
    by_session_type = serializers.DictField(
        child=serializers.IntegerField()
    )