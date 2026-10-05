"""API views for Clinical Insights."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from django.utils import timezone

from common.models import ClinicalInsight
from .serializers import (
    ClinicalInsightSerializer,
    ClinicalInsightCreateSerializer,
    ClinicalInsightStatsSerializer,
)


class ClinicalInsightViewSet(viewsets.ModelViewSet):
    """ViewSet for ClinicalInsight model with semantic search support."""
    
    queryset = ClinicalInsight.objects.all()
    serializer_class = ClinicalInsightSerializer
    permission_classes = []  # Adjust for production
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['pattern', 'recommendation']
    ordering_fields = ['created_at', 'confidence_score', 'usage_count']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ClinicalInsightCreateSerializer
        return ClinicalInsightSerializer
    
    def get_queryset(self):
        queryset = ClinicalInsight.objects.all()
        
        # Filter by session type
        session_type = self.request.query_params.get('session_type')
        if session_type:
            queryset = queryset.filter(session_type=session_type)
        
        # Filter by minimum confidence
        min_confidence = self.request.query_params.get('min_confidence')
        if min_confidence:
            queryset = queryset.filter(confidence_score__gte=float(min_confidence))
        
        return queryset
    
    def perform_create(self, serializer):
        """Create insight with optional embedding."""
        embedding = serializer.validated_data.pop('embedding', None)
        insight = serializer.save()
        if embedding:
            insight.set_embedding(embedding)
            insight.save(update_fields=['embedding'])
        return insight
    
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Get statistics about stored insights."""
        queryset = self.get_queryset()
        total = queryset.count()
        
        by_type = dict(
            queryset.values('session_type')
            .annotate(count=Count('id'))
            .values_list('session_type', 'count')
        )
        
        if total < 5:
            level = 'Novice'
        elif total < 15:
            level = 'Practitioner'
        else:
            level = 'Senior Specialist'
        
        serializer = ClinicalInsightStatsSerializer({
            'total_sessions_learned': total,
            'experience_level': level,
            'by_session_type': by_type,
        })
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='context/(?P<session_type>[^/.]+)')
    def context(self, request, session_type=None):
        """Get learning context for a session type (used by AI service)."""
        insights = ClinicalInsight.objects.filter(
            session_type=session_type
        ).order_by('-confidence_score', '-created_at')[:20]
        
        if not insights.exists():
            return Response({'context': ''})
        
        context_lines = [
            f"PREVIOUS LEARNINGS FROM SUCCESSFUL SESSIONS (Session Type: {session_type}):"
        ]
        for idx, insight in enumerate(insights, 1):
            context_lines.append(
                f"{idx}. Observed Pattern: {insight.pattern}. Clinical Rule: {insight.recommendation}"
            )
        context_lines.append("")
        context_lines.append("INSTRUCTION: Use these past patterns to make your current analysis more precise.")
        
        return Response({'context': '\n'.join(context_lines)})
    
    @action(detail=False, methods=['post'], url_path='semantic-search')
    def semantic_search(self, request):
        """Semantic search using pgvector (requires pgvector extension)."""
        query_embedding = request.data.get('embedding')
        session_type = request.data.get('session_type')
        limit = request.data.get('limit', 5)
        threshold = request.data.get('threshold', 0.7)
        
        if not query_embedding:
            return Response(
                {'error': 'embedding is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use raw SQL for pgvector similarity search
        from django.db import connection
        import struct
        
        # Convert embedding to binary format for pgvector
        query_vector = struct.pack(f'{len(query_embedding)}f', *query_embedding)
        
        with connection.cursor() as cursor:
            sql = '''
                SELECT id, session_type, pattern, recommendation, confidence_score,
                       1 - (embedding <=> %s::vector) as similarity
                FROM common_clinicalinsight
                WHERE embedding IS NOT NULL
            '''
            params = [query_vector]
            
            if session_type:
                sql += ' AND session_type = %s'
                params.append(session_type)
            
            sql += ' AND (1 - (embedding <=> %s::vector)) > %s'
            params.extend([query_vector, threshold])
            
            sql += ' ORDER BY embedding <=> %s::vector LIMIT %s'
            params.extend([query_vector, limit])
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                'id': row[0],
                'session_type': row[1],
                'pattern': row[2],
                'recommendation': row[3],
                'confidence_score': row[4],
                'similarity': float(row[5]),
            })
        
        return Response({'results': results})
    
    @action(detail=True, methods=['post'], url_path='increment-usage')
    def increment_usage(self, request, pk=None):
        """Increment usage count when insight is used."""
        insight = self.get_object()
        insight.usage_count += 1
        insight.save(update_fields=['usage_count', 'updated_at'])
        return Response({'usage_count': insight.usage_count})