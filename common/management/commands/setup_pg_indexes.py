"""Django management command to setup PostgreSQL indexes for pgvector and pg_trgm."""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Setup PostgreSQL indexes for pgvector (HNSW) and pg_trgm (GIN)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--model',
            type=str,
            default='common.ClinicalInsight',
            help='Model to create indexes for (default: common.ClinicalInsight)'
        )
        parser.add_argument(
            '--vector-field',
            type=str,
            default='embedding',
            help='Vector field name (default: embedding)'
        )
        parser.add_argument(
            '--text-fields',
            nargs='+',
            default=['pattern', 'recommendation'],
            help='Text fields for pg_trgm indexing'
        )
        parser.add_argument(
            '--dimensions',
            type=int,
            default=1536,
            help='Vector dimensions (default: 1536 for OpenAI ada-002)'
        )

    def handle(self, *args, **options):
        model_path = options['model']
        vector_field = options['vector_field']
        text_fields = options['text_fields']
        dimensions = options['dimensions']

        # Parse model path
        app_label, model_name = model_path.split('.')
        table_name = f'{app_label}_{model_name.lower()}'

        self.stdout.write(f'Setting up indexes for {table_name}...')

        with connection.cursor() as cursor:
            # 1. Create HNSW index for pgvector
            try:
                self.stdout.write(f'  Creating HNSW index on {vector_field}...')
                cursor.execute(f'''
                    CREATE INDEX IF NOT EXISTS idx_{table_name}_{vector_field}_hnsw 
                    ON {table_name} USING hnsw ({vector_field} vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                ''')
                self.stdout.write(self.style.SUCCESS(f'  ✓ HNSW index created'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  ⚠ HNSW index failed (pgvector may not be installed): {e}'))

            # 2. Create GIN indexes for pg_trgm on text fields
            for field in text_fields:
                try:
                    self.stdout.write(f'  Creating GIN trigram index on {field}...')
                    cursor.execute(f'''
                        CREATE INDEX IF NOT EXISTS idx_{table_name}_{field}_trgm 
                        ON {table_name} USING gin ({field} gin_trgm_ops);
                    ''')
                    self.stdout.write(self.style.SUCCESS(f'  ✓ GIN trigram index created on {field}'))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  ⚠ GIN index on {field} failed: {e}'))

            # 3. Verify extensions
            self.stdout.write('\nVerifying extensions...')
            cursor.execute('''
                SELECT extname, extversion 
                FROM pg_extension 
                WHERE extname IN ('vector', 'pg_trgm', 'pg_cron', 'uuid-ossp', 'btree_gin', 'btree_gist')
                ORDER BY extname;
            ''')
            extensions = cursor.fetchall()
            for ext in extensions:
                self.stdout.write(f'  ✓ {ext[0]} v{ext[1]}')

            # 4. Show existing indexes
            self.stdout.write('\nExisting indexes:')
            cursor.execute(f'''
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = '{table_name}'
                ORDER BY indexname;
            ''')
            indexes = cursor.fetchall()
            for idx in indexes:
                self.stdout.write(f'  - {idx[0]}')

        self.stdout.write(self.style.SUCCESS('\nIndex setup complete!'))