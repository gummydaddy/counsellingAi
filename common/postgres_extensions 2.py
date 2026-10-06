"""
PostgreSQL Extensions Setup for MindPath
Enables: pgvector, pg_cron, pg_search (pg_trgm), and other useful extensions
"""

from django.db import connection
from django.db.migrations.operations.base import Operation


class CreateExtension(Operation):
    """Django migration operation to create PostgreSQL extensions"""
    
    def __init__(self, name: str):
        self.name = name
    
    def state_forwards(self, app_label, state):
        pass
    
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        schema_editor.execute(f'CREATE EXTENSION IF NOT EXISTS "{self.name}";')
    
    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        schema_editor.execute(f'DROP EXTENSION IF EXISTS "{self.name}";')
    
    def describe(self):
        return f'Create PostgreSQL extension: {self.name}'


# Core extensions needed for the project
REQUIRED_EXTENSIONS = [
    'vector',           # pgvector - for embeddings/semantic search
    'pg_trgm',          # trigram similarity - for fuzzy text search
    'pg_cron',          # cron jobs in PostgreSQL
    'uuid-ossp',        # UUID generation
    'btree_gin',        # GIN index support for btree types
    'btree_gist',       # GiST index support for btree types
]


def enable_extensions():
    """Enable all required PostgreSQL extensions. Call from migration or management command."""
    with connection.cursor() as cursor:
        for ext in REQUIRED_EXTENSIONS:
            try:
                cursor.execute(f'CREATE EXTENSION IF NOT EXISTS "{ext}";')
                print(f"Enabled extension: {ext}")
            except Exception as e:
                print(f"Failed to enable {ext}: {e}")


def disable_extensions():
    """Disable all extensions (for rollback)."""
    with connection.cursor() as cursor:
        for ext in reversed(REQUIRED_EXTENSIONS):
            try:
                cursor.execute(f'DROP EXTENSION IF EXISTS "{ext}";')
                print(f"Disabled extension: {ext}")
            except Exception as e:
                print(f"Failed to disable {ext}: {e}")


def setup_pgvector_hnsw_index(table_name: str, column_name: str, dimensions: int = 1536):
    """Create HNSW index for pgvector column (fast approximate nearest neighbor search)."""
    with connection.cursor() as cursor:
        cursor.execute(f'''
            CREATE INDEX IF NOT EXISTS idx_{table_name}_{column_name}_hnsw 
            ON {table_name} USING hnsw ({column_name} vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        ''')


def setup_pg_trgm_index(table_name: str, column_name: str):
    """Create GIN index with pg_trgm for fuzzy text search."""
    with connection.cursor() as cursor:
        cursor.execute(f'''
            CREATE INDEX IF NOT EXISTS idx_{table_name}_{column_name}_trgm 
            ON {table_name} USING gin ({column_name} gin_trgm_ops);
        ''')


def setup_pg_cron_job(job_name: str, schedule: str, command: str, database: str = 'mindpath'):
    """Schedule a cron job using pg_cron."""
    with connection.cursor() as cursor:
        cursor.execute(f'''
            SELECT cron.schedule('{job_name}', '{schedule}', '{command}', '{database}');
        ''')
        # Alternative unschedule:
        # cursor.execute(f"SELECT cron.unschedule('{job_name}');")


def get_extension_status():
    """Check which extensions are installed."""
    with connection.cursor() as cursor:
        cursor.execute('''
            SELECT extname, extversion 
            FROM pg_extension 
            WHERE extname IN %s
            ORDER BY extname;
        ''', (tuple(REQUIRED_EXTENSIONS),))
        return cursor.fetchall()