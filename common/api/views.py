"""API views for Clinical Insights and Counselling Sessions."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from django.utils import timezone

from common.models import ClinicalInsight, CounsellingSession
from .serializers import (
    ClinicalInsightSerializer,
    ClinicalInsightCreateSerializer,
    ClinicalInsightStatsSerializer,
    CounsellingSessionSerializer,
    CounsellingSessionListSerializer,
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


class CounsellingSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for CounsellingSession model."""

    queryset = CounsellingSession.objects.all()
    permission_classes = []  # Adjust for production
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ['created_at', 'updated_at', 'status']
    ordering = ['-updated_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return CounsellingSessionListSerializer
        return CounsellingSessionSerializer

    def get_queryset(self):
        # Users can only see their own sessions
        user = self.request.user
        if user.is_authenticated:
            return CounsellingSession.objects.filter(user=user)
        return CounsellingSession.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Get statistics about user's sessions."""
        queryset = self.get_queryset()
        total = queryset.count()
        completed = queryset.filter(status='completed').count()
        in_progress = queryset.filter(status='in_progress').count()

        by_type = dict(
            queryset.values('session_type')
            .annotate(count=Count('id'))
            .values_list('session_type', 'count')
        )

        return Response({
            'total_sessions': total,
            'completed_sessions': completed,
            'in_progress_sessions': in_progress,
            'by_session_type': by_type,
        })

    @action(detail=True, methods=['post'], url_path='retry')
    def retry(self, request, pk=None):
        """Retry session from a specific step."""
        session = self.get_object()
        step = request.data.get('step')
        
        if not step:
            return Response(
                {'error': 'step is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reset progress from the failed step onwards
        new_progress = {
            'current_step': step,
            'phase1_generated': False,
            'mcq_completed': False,
            'assessment_completed': False,
            'analysis_completed': False,
            'last_error': None,
            'error_step': None,
            'assessment_phase': 'INITIAL',
            'current_question_index': 0,
            'assessment_questions': [],
        }

        # Preserve completed phases before the retry step
        step_order = ['WELCOME', 'SESSION_SELECTION', 'NOTES_PROMPT', 'NOTES_INPUT', 'MCQ_PHASE', 'GENERATING_PHASE1', 'ASSESSMENT', 'ANALYZING', 'RESULTS', 'ERROR']
        try:
            step_index = step_order.index(step)
        except ValueError:
            step_index = 0

        if step_index > step_order.index('MCQ_PHASE'):
            new_progress['mcq_completed'] = session.mcq_completed
        if step_index > step_order.index('GENERATING_PHASE1'):
            new_progress['phase1_generated'] = session.phase1_generated
        if step_index > step_order.index('ASSESSMENT'):
            new_progress['assessment_completed'] = session.assessment_completed
            new_progress['assessment_phase'] = session.assessment_phase
            new_progress['current_question_index'] = session.current_question_index
            new_progress['assessment_questions'] = session.assessment_questions
        elif step == 'ASSESSMENT':
            new_progress['assessment_phase'] = session.assessment_phase
            new_progress['current_question_index'] = session.current_question_index
            new_progress['assessment_questions'] = session.assessment_questions
        if step_index > step_order.index('ANALYZING'):
            new_progress['analysis_completed'] = session.analysis_completed

        session.status = 'in_progress'
        for key, value in new_progress.items():
            setattr(session, key, value)
        session.save()

        return Response(CounsellingSessionSerializer(session).data)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        """Complete a session with results."""
        session = self.get_object()
        result = request.data.get('result')

        if not result:
            return Response(
                {'error': 'result is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate title based on result
        type_labels = {
            'school': 'Academic',
            'medical': 'Medical',
            'psychological': 'Psychological',
            'career': 'Career',
            'relationship': 'Relationship',
        }
        label = type_labels.get(session.session_type, session.session_type)
        from datetime import datetime
        date = datetime.now().strftime('%b %d')
        archetype = result.get('archetype', '') if isinstance(result, dict) else ''
        archetype_str = f' — {archetype}' if archetype else ''
        session.title = f'{label} Session{archetype_str} ({date})'

        session.status = 'completed'
        session.current_step = 'RESULTS'
        session.analysis_completed = True
        session.last_error = None
        session.error_step = None
        session.result = result
        session.save()

        return Response(CounsellingSessionSerializer(session).data)