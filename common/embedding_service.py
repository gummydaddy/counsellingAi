"""Embedding service - generates and stores pgvector embeddings for clinical insights."""

import hashlib
import struct
import logging
import math
from typing import Optional

from common.models import ClinicalInsight

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generate and store embeddings for clinical insights."""
    
    # Default embedding dimension (OpenAI ada-002 compatible)
    EMBEDDING_DIM = 1536

    @staticmethod
    def generate_embedding(text: str, provider: str = "mock") -> list[float]:
        """
        Generate embedding for text.
        
        Args:
            text: Text to embed
            provider: Embedding provider ("mock", "openai", "local")
            
        Returns:
            List of floats representing the embedding vector
        """
        if provider == "openai":
            return EmbeddingService._generate_openai_embedding(text)
        elif provider == "local":
            return EmbeddingService._generate_local_embedding(text)
        else:
            return EmbeddingService._generate_mock_embedding(text)

    @staticmethod
    def _generate_mock_embedding(text: str) -> list[float]:
        """
        Generate deterministic mock embedding using hash.
        Used for development/testing when no embedding provider is available.
        """
        # Create a deterministic hash-based vector
        hash_bytes = hashlib.sha256(text.encode()).digest()
        
        # Expand to EMBEDDING_DIM dimensions using hash
        vector = []
        for i in range(EmbeddingService.EMBEDDING_DIM):
            byte_idx = i % 32
            # Normalize to [-1, 1] range
            val = (hash_bytes[byte_idx] / 255.0) * 2 - 1
            # Add some variation based on position
            val = val * (0.5 + 0.5 * (i % 10) / 10)
            vector.append(val)
        
        # Normalize to unit length
        magnitude = sum(v * v for v in vector) ** 0.5
        if magnitude > 0:
            vector = [v / magnitude for v in vector]
        
        return vector

    @staticmethod
    def _generate_openai_embedding(text: str) -> list[float]:
        """Generate embedding using OpenAI API."""
        try:
            import openai
            import os
            
            api_key = os.environ.get('OPENAI_API_KEY')
            if not api_key:
                logger.warning("OPENAI_API_KEY not set, falling back to mock embedding")
                return EmbeddingService._generate_mock_embedding(text)
            
            client = openai.OpenAI(api_key=api_key)
            response = client.embeddings.create(
                model="text-embedding-ada-002",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}, falling back to mock")
            return EmbeddingService._generate_mock_embedding(text)

    @staticmethod
    def _generate_local_embedding(text: str) -> list[float]:
        """Generate embedding using local sentence-transformers model."""
        try:
            from sentence_transformers import SentenceTransformer
            import os
            
            model_name = os.environ.get('LOCAL_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
            model = SentenceTransformer(model_name)
            embedding = model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Local embedding failed: {e}, falling back to mock")
            return EmbeddingService._generate_mock_embedding(text)

    @staticmethod
    def store_embedding(insight: ClinicalInsight, provider: str = "mock") -> bool:
        """
        Generate and store embedding for insight.
        
        Args:
            insight: ClinicalInsight instance
            provider: Embedding provider to use
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Combine pattern and recommendation for embedding
            text = f"{insight.pattern} {insight.recommendation}"
            embedding = EmbeddingService.generate_embedding(text, provider)
            insight.set_embedding(embedding)
            insight.save(update_fields=['embedding', 'updated_at'])
            logger.info(f"Stored embedding for insight {insight.id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store embedding for insight {insight.id}: {e}")
            return False

    @staticmethod
    def bulk_store_embeddings(insights: list[ClinicalInsight], provider: str = "mock") -> int:
        """Store embeddings for multiple insights."""
        success_count = 0
        for insight in insights:
            if EmbeddingService.store_embedding(insight, provider):
                success_count += 1
        return success_count

    @staticmethod
    def similarity_search(
        query_embedding: list[float],
        session_type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 5,
        threshold: float = 0.7
    ) -> list[dict]:
        """
        Perform semantic similarity search using pgvector.
        Requires PostgreSQL with pgvector extension.
        Falls back to Python-based cosine similarity for SQLite.
        """
        try:
            from django.db import connection
            from common.models import ClinicalInsight
            
            # Check if we're using PostgreSQL with pgvector
            from django.conf import settings
            db_engine = settings.DATABASES['default']['ENGINE']
            
            if 'postgresql' in db_engine:
                # Use pgvector for PostgreSQL
                return EmbeddingService._pgvector_similarity_search(
                    query_embedding, session_type, user_id, limit, threshold
                )
            else:
                # Fallback: Python-based cosine similarity for SQLite
                return EmbeddingService._python_similarity_search(
                    query_embedding, session_type, user_id, limit, threshold
                )
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []

    @staticmethod
    def _pgvector_similarity_search(
        query_embedding: list[float],
        session_type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 5,
        threshold: float = 0.7
    ) -> list[dict]:
        """pgvector-based similarity search for PostgreSQL."""
        from django.db import connection
        import struct
        
        query_vector = struct.pack(f'{len(query_embedding)}f', *query_embedding)
        
        with connection.cursor() as cursor:
            sql = '''
                SELECT id, session_type, pattern, recommendation, confidence_score,
                       user_id, source_session_id,
                       1 - (embedding <=> %s::vector) as similarity
                FROM common_clinicalinsight
                WHERE embedding IS NOT NULL
            '''
            params = [query_vector]
            
            if session_type:
                sql += ' AND session_type = %s'
                params.append(session_type)
            
            if user_id:
                sql += ' AND user_id = %s'
                params.append(user_id)
            
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
                'user_id': row[5],
                'source_session_id': row[6],
                'similarity': float(row[7]),
            })
        
        return results

    @staticmethod
    def _python_similarity_search(
        query_embedding: list[float],
        session_type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 5,
        threshold: float = 0.7
    ) -> list[dict]:
        """Python-based cosine similarity search for SQLite (development)."""
        from common.models import ClinicalInsight
        import math
        
        # Build queryset
        queryset = ClinicalInsight.objects.filter(embedding__isnull=False)
        if session_type:
            queryset = queryset.filter(session_type=session_type)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Compute cosine similarity in Python
        results = []
        for insight in queryset:
            insight_embedding = insight.get_embedding()
            if not insight_embedding:
                continue
            
            # Cosine similarity
            dot_product = sum(q * i for q, i in zip(query_embedding, insight_embedding))
            mag_q = math.sqrt(sum(q * q for q in query_embedding))
            mag_i = math.sqrt(sum(i * i for i in insight_embedding))
            
            if mag_q == 0 or mag_i == 0:
                continue
                
            similarity = dot_product / (mag_q * mag_i)
            
            if similarity > threshold:
                results.append({
                    'id': str(insight.id),
                    'session_type': insight.session_type,
                    'pattern': insight.pattern,
                    'recommendation': insight.recommendation,
                    'confidence_score': insight.confidence_score,
                    'user_id': str(insight.user_id) if insight.user_id else None,
                    'source_session_id': str(insight.source_session_id) if insight.source_session_id else None,
                    'similarity': similarity,
                })
        
        # Sort by similarity and limit
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:limit]