# Knowledge Base (KB) Implementation Plan

## Current State Assessment

### ✅ What Exists
1. **ClinicalInsight model** (`common/models.py:281-331`) - UUID, session_type, pattern, recommendation, embedding (BinaryField), confidence_score, usage_count
2. **Django API** (`common/api/views.py`) - Full CRUD + stats + context + semantic-search (raw SQL pgvector)
3. **Frontend KnowledgeBaseService** (`frontend/services/knowledgeBaseService.ts`) - DjangoBackendProvider + LocalStorageProvider fallback
4. **Cross-session analysis** (`frontend/services/crossSessionAnalysis.ts`) - User embeddings, trait vectors, archetype tracking in localStorage
5. **Session completion hook** - Calls `crossSessionAnalysis.updateUserEmbedding()` and `generateCrossSessionInsights()`

### ❌ Critical Gaps

| Gap | Impact |
|-----|--------|
| **No insight extraction from completed sessions** | KB never learns from actual user sessions |
| **No embedding generation** | `ClinicalInsight.set_embedding()` never called; pgvector search won't work |
| **No User/Session linkage** | ClinicalInsight model has no FK to User or CounsellingSession |
| **pgvector requires PostgreSQL** | Currently SQLite in dev; no pgvector extension |
| **No background processing** | Insight extraction needs async/batch processing |

---

## Implementation Plan

### Phase 1: Data Model Fixes (Backend)

#### 1.1 Add User/Session linkage to ClinicalInsight
```python
# common/models.py - ClinicalInsight model
user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="clinical_insights"
)
source_session = models.ForeignKey(
    'CounsellingSession',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="generated_insights"
)
# Add index for user+session_type queries
models.Index(fields=['user', 'session_type', '-created_at']),
```

#### 1.2 Create Insight Extraction Service
```python
# common/services/insight_extraction.py
class InsightExtractionService:
    @staticmethod
    def extract_insights_from_session(session: CounsellingSession) -> list[ClinicalInsight]:
        """Extract patterns from completed session and create ClinicalInsight objects."""
        if not session.result:
            return []
        
        insights = []
        result = session.result
        
        # Pattern 1: Risk flag patterns
        if result.riskAssessment.flags:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Risk flags: {', '.join(result.riskAssessment.flags)} in {session.session_type} context",
                recommendation=f"Monitor for {', '.join(result.riskAssessment.flags)}; consider early intervention",
                confidence_score=0.8
            ))
        
        # Pattern 2: Archetype + trait combination
        dominant_traits = [k for k, v in result.traits.items() if v > 70]
        if dominant_traits:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Archetype '{result.archetype}' with dominant traits: {', '.join(dominant_traits)}",
                recommendation=f"Leverage strengths in {', '.join(dominant_traits)}; support development in weaker areas",
                confidence_score=0.75
            ))
        
        # Pattern 3: Risk level patterns
        if result.riskAssessment.level in ['High', 'Critical']:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"{result.riskAssessment.level} risk detected with archetype '{result.archetype}'",
                recommendation="Immediate professional referral recommended; safety planning needed",
                confidence_score=0.9
            ))
        
        return insights
```

#### 1.3 Add Embedding Generation
```python
# common/services/embedding_service.py
class EmbeddingService:
    @staticmethod
    def generate_embedding(text: str) -> list[float]:
        """Generate embedding using OpenAI/other provider."""
        # TODO: Integrate with actual embedding provider
        # For now, return deterministic hash-based vector for testing
        import hashlib
        hash_bytes = hashlib.sha256(text.encode()).digest()
        # Convert to 1536-dim vector (OpenAI ada-002 size)
        vector = []
        for i in range(1536):
            byte_idx = i % 32
            vector.append((hash_bytes[byte_idx] / 255.0) * 2 - 1)
        return vector
    
    @staticmethod
    def store_embedding(insight: ClinicalInsight):
        """Generate and store embedding for insight."""
        text = f"{insight.pattern} {insight.recommendation}"
        embedding = EmbeddingService.generate_embedding(text)
        insight.set_embedding(embedding)
        insight.save(update_fields=['embedding'])
```

### Phase 2: Integration with Session Completion

#### 2.1 Modify Session Completion Flow
```python
# frontend/services/session.service.ts - completeSession()
async completeSession(userId: string, sessionId: string, result: AnalysisResult): Promise<CounsellingSession | null> {
    // ... existing code ...
    
    // After session is completed on backend
    if (completedSession) {
        // Trigger insight extraction (async, non-blocking)
        extractInsightsFromSession(userId, sessionId).catch(console.error);
        
        crossSessionAnalysis.updateUserEmbedding(userId, session);
        crossSessionAnalysis.generateCrossSessionInsights(userId).catch(console.error);
    }
    return session;
}
```

#### 2.2 Add Insight Extraction API Call
```python
# organizations/api/views.py or common/api/views.py
@action(detail=True, methods=['post'], url_path='extract-insights')
def extract_insights(self, request, pk=None):
    """Extract and store clinical insights from completed session."""
    session = get_object_or_404(CounsellingSession, pk=pk, user=request.user)
    if session.status != 'completed':
        return Response({'error': 'Session must be completed'}, status=400)
    
    insights = InsightExtractionService.extract_insights_from_session(session)
    for insight in insights:
        EmbeddingService.store_embedding(insight)
    
    return Response({'insights_created': len(insights)}, status=201)
```

### Phase 3: pgvector Production Setup

#### 3.1 Database Migration
```sql
-- PostgreSQL migration (requires pgvector extension)
CREATE EXTENSION IF NOT EXISTS vector;

-- Alter embedding column to use vector type
ALTER TABLE common_clinicalinsight 
ALTER COLUMN embedding TYPE vector(1536) 
USING embedding::vector;

-- Create HNSW index for fast similarity search
CREATE INDEX ON common_clinicalinsight 
USING hnsw (embedding vector_cosine_ops);
```

#### 3.2 Django Settings for Production
```python
# config/settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        # ... postgres config ...
        'OPTIONS': {
            'extensions': ['vector'],  # Requires django-pgvector or manual migration
        }
    }
}
```

### Phase 4: Frontend Enhancements

#### 4.1 User-Specific KB Views
```typescript
// frontend/services/knowledgeBaseService.ts
getUserInsights: (userId: string) => CurrentProvider.getUserInsights(userId),
getInsightsForSessionType: (userId: string, sessionType: string) => ...
```

#### 4.2 Enhanced Context with User History
```typescript
// In getEnhancedContext() - already partially implemented
// Add user-specific insights from KB
const userInsights = await KnowledgeBaseService.getUserInsights(userId);
```

---

## Validation Checklist

| Test | Expected Result |
|------|-----------------|
| Complete a session → insights created | ClinicalInsight rows with user, session_type, embedding |
| Semantic search with query embedding | Returns relevant insights via pgvector |
| Cross-session analysis uses KB | Context includes historical patterns |
| Multiple users → data isolation | User A never sees User B's insights |

---

## Open Questions

1. **Embedding provider**: OpenAI ada-002 (1536-dim) vs local model (e.g., sentence-transformers)?
2. **Extraction timing**: Sync during session completion vs async background job (Celery)?
3. **Insight deduplication**: How to avoid duplicate patterns across sessions?
4. **Privacy**: Should insights be anonymized before KB storage?
5. **Retention**: TTL for insights? Auto-decay confidence_score over time?

---

## Next Steps Priority

1. **High**: Add User/Session FKs to ClinicalInsight model + migration
2. **High**: Create InsightExtractionService + integrate with session completion
3. **Medium**: Add embedding generation (mock for dev, real for prod)
4. **Medium**: pgvector migration + HNSW index for production
5. **Low**: Frontend KB browsing UI, insight deduplication logic