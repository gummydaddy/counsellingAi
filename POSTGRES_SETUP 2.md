# PostgreSQL + pgvector + pg_cron + pg_trgm Setup Summary

## Overview
Both the frontend (React/Vite) and backend (Django) are now configured to use PostgreSQL with advanced extensions:
- **pgvector** - Vector embeddings for semantic search
- **pg_cron** - Scheduled jobs within PostgreSQL
- **pg_trgm** - Trigram similarity for fuzzy text search
- **uuid-ossp** - UUID generation
- **btree_gin/btree_gist** - Advanced indexing support

---

## Backend (Django) Changes

### 1. `config/settings.py`
- Updated DATABASES to use PostgreSQL with environment variables
- Added CONN_MAX_AGE for connection pooling
- SSL mode configurable via `DB_SSLMODE`

### 2. `common/models.py`
Added `ClinicalInsight` model with:
- UUID primary key
- Session type categorization
- Pattern & recommendation text fields
- **pgvector embedding field** (BinaryField for vector storage)
- Confidence score & usage tracking
- Database indexes for performance

### 3. `common/api/`
- **serializers.py**: DRF serializers for ClinicalInsight (including embedding support)
- **views.py**: ViewSet with:
  - CRUD operations
  - `/stats/` - Learning statistics
  - `/context/<session_type>/` - AI learning context endpoint
  - `/semantic-search/` - pgvector similarity search
  - `/increment-usage/` - Track insight usage
- **urls.py**: REST API routes at `/api/common/insights/`

### 4. `common/postgres_extensions.py`
Utility module for:
- Enabling PostgreSQL extensions
- Creating HNSW indexes (pgvector)
- Creating GIN trigram indexes (pg_trgm)
- Scheduling pg_cron jobs

### 5. `common/migrations/`
- `0003_add_clinical_insight.py` - ClinicalInsight model
- `0004_enable_pg_extensions.py` - Extension setup via RunSQL

### 6. `common/management/commands/`
- `setup_pg_indexes.py` - Create HNSW + GIN indexes
- `manage_pg_cron.py` - Schedule/manage cron jobs

### 7. `requirements.txt`
Python dependencies including `pgvector` for Django ORM support

---

## Frontend (React/Vite) Changes

### 1. `services/knowledgeBaseService.ts`
Updated to use Django backend API:
- **DjangoBackendProvider** - Primary provider calling `/api/common/insights/`
- **LocalStorageProvider** - Fallback for offline/demo mode
- Automatic fallback if backend unavailable
- New `getContext()` method for AI learning context

### 2. `.env.example`
Added all required environment variables for both frontend and backend

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/common/insights/` | List insights (paginated, filterable) |
| POST | `/api/common/insights/` | Create new insight |
| GET | `/api/common/insights/{id}/` | Retrieve insight |
| PATCH | `/api/common/insights/{id}/` | Update insight |
| DELETE | `/api/common/insights/{id}/` | Delete insight |
| GET | `/api/common/insights/stats/` | Learning statistics |
| GET | `/api/common/insights/context/{type}/` | AI context for session type |
| POST | `/api/common/insights/semantic-search/` | Vector similarity search |
| POST | `/api/common/insights/{id}/increment-usage/` | Track usage |

---

## Deployment Steps

### 1. PostgreSQL Setup
```sql
-- Run as superuser
CREATE DATABASE mindpath;
CREATE USER postgres WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE mindpath TO postgres;

-- Enable extensions (requires superuser)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2. Environment Variables
```env
# Backend
DB_NAME=mindpath
DB_USER=postgres
DB_PASSWORD=secure_password
DB_HOST=your-postgres-host
DB_PORT=5432
DB_SSLMODE=require
DJANGO_SECRET_KEY=generate-with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com
JWT_SIGNING_KEY=generate-secure-random-string

# Frontend
VITE_KIRA_API_KEY=your_kira_key
VITE_KIRA_MODEL=minimax-m3-free
```

### 3. Run Migrations & Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Setup PostgreSQL indexes (after pgvector extension enabled)
python manage.py setup_pg_indexes

# Optional: Schedule cron jobs
python manage.py manage_pg_cron schedule \
  --job-name "cleanup_old_insights" \
  --schedule "0 3 * * 0" \
  --command "DELETE FROM common_clinicalinsight WHERE created_at < NOW() - INTERVAL '90 days';"
```

### 4. Collect Static Files
```bash
python manage.py collectstatic --noinput
```

---

## Usage Examples

### Add Insight with Embedding (from AI analysis)
```python
import requests
import json

# Generate embedding from your AI service
embedding = get_embedding("User shows high anxiety about career decisions")

response = requests.post('https://api.yourdomain.com/api/common/insights/', json={
    'session_type': 'career',
    'pattern': 'High anxiety when facing career transitions',
    'recommendation': 'Use structured decision-making framework with values clarification',
    'confidence_score': 0.92,
    'embedding': embedding  # Optional: list of 1536 floats
})
```

### Semantic Search for Similar Insights
```python
response = requests.post('https://api.yourdomain.com/api/common/insights/semantic-search/', json={
    'embedding': query_embedding,
    'session_type': 'career',
    'limit': 5,
    'threshold': 0.75
})
# Returns insights with similarity scores
```

### Frontend Usage (Automatic)
```typescript
// KnowledgeBaseService automatically uses Django backend
const context = await KnowledgeBaseService.getLearningContext('career');
// Calls: GET /api/common/insights/context/career/

await KnowledgeBaseService.addInsight({
  sessionType: 'career',
  pattern: 'New pattern discovered',
  recommendation: 'Clinical recommendation',
  confidenceScore: 0.85
});
// POSTs to: /api/common/insights/
```

---

## Production Considerations

1. **pg_cron**: Requires `shared_preload_libraries = 'pg_cron'` in postgresql.conf
2. **pgvector HNSW**: Requires PostgreSQL 16+ for best performance
3. **Connection Pooling**: Use PgBouncer for production
4. **Read Replicas**: Route search queries to replicas
5. **Monitoring**: Track index usage with `pg_stat_user_indexes`
6. **Backup**: Include vector data in backups (pg_dump handles this)

---

## Testing Commands
```bash
# Check extensions
python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute('SELECT extname FROM pg_extension WHERE extname IN (\'vector\',\'pg_trgm\',\'pg_cron\')')
    print(c.fetchall())
"

# Test API
curl http://localhost:8000/api/common/insights/stats/

# Run indexes setup
python manage.py setup_pg_indexes --model common.ClinicalInsight
```