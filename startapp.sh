#!/bin/bash
# Django Application Startup Script
# Usage: ./startapp.sh [command]
# Commands: setup, migrate, indexes, cron, collectstatic, runserver, test, shell, superuser

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${PROJECT_DIR}/.venv"
MANAGE_PY="${PROJECT_DIR}/manage.py"
PYTHON="${VENV_DIR}/bin/python"

# Load environment variables
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
    echo -e "${GREEN}✓${NC} Loaded .env file"
elif [ -f "${PROJECT_DIR}/.env.local" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env.local" | xargs)
    echo -e "${GREEN}✓${NC} Loaded .env.local file"
else
    echo -e "${YELLOW}⚠${NC} No .env file found, using defaults"
fi

# Function to check if virtual environment exists
check_venv() {
    if [ ! -f "${PYTHON}" ]; then
        echo -e "${RED}✗${NC} Virtual environment not found at ${VENV_DIR}"
        echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
        exit 1
    fi
}

# Function to install dependencies
install_deps() {
    echo -e "${BLUE}📦${NC} Installing Python dependencies..."
    "${VENV_DIR}/bin/pip" install --upgrade pip
    "${VENV_DIR}/bin/pip" install -r "${PROJECT_DIR}/requirements.txt"
    echo -e "${GREEN}✓${NC} Dependencies installed"
}

# Function to check database connection
check_db() {
    echo -e "${BLUE}🔌${NC} Checking database connection..."
    "${PYTHON}" -c "
import os
import psycopg2
try:
    conn = psycopg2.connect(
        dbname=os.getenv('DB_NAME', 'mindpath'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', ''),
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432')
    )
    conn.close()
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
"
}

# Function to run migrations
run_migrations() {
    echo -e "${BLUE}🔄${NC} Running database migrations..."
    "${PYTHON}" "${MANAGE_PY}" migrate --noinput
    echo -e "${GREEN}✓${NC} Migrations complete"
}

# Function to setup PostgreSQL indexes
setup_indexes() {
    echo -e "${BLUE}📊${NC} Setting up PostgreSQL indexes (pgvector HNSW + pg_trgm GIN)..."
    "${PYTHON}" "${MANAGE_PY}" setup_pg_indexes || true
    echo -e "${GREEN}✓${NC} Indexes setup complete"
}

# Function to setup pg_cron jobs
setup_cron() {
    echo -e "${BLUE}⏰${NC} Setting up pg_cron scheduled jobs..."
    
    # Example: Cleanup old insights weekly
    "${PYTHON}" "${MANAGE_PY}" manage_pg_cron schedule \
        --job-name "cleanup_old_insights" \
        --schedule "0 3 * * 0" \
        --command "DELETE FROM common_clinicalinsight WHERE created_at < NOW() - INTERVAL '90 days';" \
        || true
    
    # Example: Update insight stats daily
    "${PYTHON}" "${MANAGE_PY}" manage_pg_cron schedule \
        --job-name "update_insight_stats" \
        --schedule "0 4 * * *" \
        --command "UPDATE common_clinicalinsight SET usage_count = usage_count + 0 WHERE true;" \
        || true
    
    echo -e "${GREEN}✓${NC} Cron jobs configured"
}

# Function to collect static files
collect_static() {
    echo -e "${BLUE}📁${NC} Collecting static files..."
    "${PYTHON}" "${MANAGE_PY}" collectstatic --noinput --clear
    echo -e "${GREEN}✓${NC} Static files collected"
}

# Function to create superuser
create_superuser() {
    echo -e "${BLUE}👤${NC} Creating superuser..."
    "${PYTHON}" "${MANAGE_PY}" shell -c "
from identity.models import User
import os

email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@mindpath.ai')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')

if not User.objects.filter(email=email).exists():
    User.objects.create_superuser(email=email, password=password)
    print(f'Superuser created: {email}')
else:
    print(f'Superuser already exists: {email}')
"
}

# Function to run development server
run_server() {
    echo -e "${BLUE}🚀${NC} Starting Django development server..."
    echo -e "${GREEN}Server running at:${NC} http://${DJANGO_HOST:-127.0.0.1}:${DJANGO_PORT:-8000}"
    "${PYTHON}" "${MANAGE_PY}" runserver "${DJANGO_HOST:-127.0.0.1}:${DJANGO_PORT:-8000}"
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}🧪${NC} Running tests..."
    "${PYTHON}" "${MANAGE_PY}" test --verbosity=2
}

# Function to open Django shell
open_shell() {
    echo -e "${BLUE}🐚${NC} Opening Django shell..."
    "${PYTHON}" "${MANAGE_PY}" shell
}

# Function to show migration status
show_migrations() {
    echo -e "${BLUE}📋${NC} Migration status:"
    "${PYTHON}" "${MANAGE_PY}" showmigrations
}

# Function to create new migration
make_migration() {
    app_name="${1:-common}"
    echo -e "${BLUE}📝${NC} Creating migration for ${app_name}..."
    "${PYTHON}" "${MANAGE_PY}" makemigrations "${app_name}"
}

# Main command dispatcher
case "${1:-setup}" in
    setup)
        echo -e "${BLUE}═══════════════════════════════════════${NC}"
        echo -e "${BLUE}   MindPath Django Setup${NC}"
        echo -e "${BLUE}═══════════════════════════════════════${NC}"
        check_venv
        install_deps
        check_db
        run_migrations
        setup_indexes
        setup_cron
        collect_static
        create_superuser
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo -e "${GREEN}   Setup complete!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo -e "Run ${YELLOW}./startapp.sh runserver${NC} to start the server"
        ;;
    
    migrate)
        check_venv
        check_db
        run_migrations
        ;;
    
    indexes)
        check_venv
        setup_indexes
        ;;
    
    cron)
        check_venv
        setup_cron
        ;;
    
    collectstatic)
        check_venv
        collect_static
        ;;
    
    runserver)
        check_venv
        run_server
        ;;
    
    test)
        check_venv
        run_tests
        ;;
    
    shell)
        check_venv
        open_shell
        ;;
    
    superuser)
        check_venv
        create_superuser
        ;;
    
    migrations)
        check_venv
        show_migrations
        ;;
    
    makemigrations)
        check_venv
        make_migration "${2}"
        ;;
    
    install)
        if [ ! -d "${VENV_DIR}" ]; then
            echo -e "${BLUE}🔧${NC} Creating virtual environment..."
            python3 -m venv "${VENV_DIR}"
        fi
        install_deps
        ;;
    
    *)
        echo -e "${YELLOW}Usage:${NC} ./startapp.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup         - Full setup (install, migrate, indexes, cron, static, superuser)"
        echo "  install       - Create venv and install dependencies"
        echo "  migrate       - Run database migrations"
        echo "  indexes       - Setup pgvector HNSW + pg_trgm GIN indexes"
        echo "  cron          - Configure pg_cron scheduled jobs"
        echo "  collectstatic - Collect static files"
        echo "  runserver     - Start development server"
        echo "  test          - Run tests"
        echo "  shell         - Open Django shell"
        echo "  superuser     - Create admin superuser"
        echo "  migrations    - Show migration status"
        echo "  makemigrations [app] - Create new migration"
        ;;
esac