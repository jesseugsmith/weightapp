#!/bin/bash

# Docker PocketBase Management Script
# This script helps manage your PocketBase Docker container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 {start|stop|restart|logs|backup|restore|migrate|shell|clean}"
    echo ""
    echo "Commands:"
    echo "  start       Start PocketBase container"
    echo "  stop        Stop PocketBase container"
    echo "  restart     Restart PocketBase container"
    echo "  logs        Show container logs"
    echo "  backup      Create a backup of PocketBase data"
    echo "  restore     Restore from backup"
    echo "  migrate     Run database migrations"
    echo "  shell       Access container shell"
    echo "  clean       Remove containers and volumes (DESTRUCTIVE)"
    echo "  prod        Start with production profile (includes Nginx)"
}

# Start containers
start_containers() {
    log_info "Starting PocketBase containers..."
    
    if [ "$1" = "prod" ]; then
        docker-compose --profile production up -d
    else
        docker-compose up -d pocketbase
    fi
    
    log_success "Containers started!"
    log_info "PocketBase Admin UI: http://localhost:8090/_/"
    log_info "API Endpoint: http://localhost:8090/api/"
    
    if [ "$1" = "prod" ]; then
        log_info "Nginx Proxy: http://localhost"
    fi
}

# Stop containers
stop_containers() {
    log_info "Stopping PocketBase containers..."
    docker-compose down
    log_success "Containers stopped!"
}

# Restart containers
restart_containers() {
    log_info "Restarting PocketBase containers..."
    docker-compose restart
    log_success "Containers restarted!"
}

# Show logs
show_logs() {
    log_info "Showing PocketBase logs (Ctrl+C to exit)..."
    docker-compose logs -f pocketbase
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    BACKUP_NAME="pocketbase_backup_$(date +%Y%m%d_%H%M%S)"
    BACKUP_DIR="./backups"
    
    mkdir -p "$BACKUP_DIR"
    
    # Create backup using docker exec
    docker-compose exec pocketbase /usr/local/bin/pocketbase backup "/pb_data/${BACKUP_NAME}.zip"
    
    # Copy backup to host
    docker cp "fitclash-pocketbase:/pb_data/${BACKUP_NAME}.zip" "${BACKUP_DIR}/"
    
    # Remove backup from container
    docker-compose exec pocketbase rm "/pb_data/${BACKUP_NAME}.zip"
    
    log_success "Backup created: ${BACKUP_DIR}/${BACKUP_NAME}.zip"
}

# Restore from backup
restore_backup() {
    log_warning "This will overwrite your current database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled."
        exit 0
    fi
    
    # List available backups
    echo "Available backups:"
    ls -la ./backups/*.zip 2>/dev/null || {
        log_error "No backups found in ./backups/"
        exit 1
    }
    
    read -p "Enter backup filename: " BACKUP_FILE
    
    if [ ! -f "./backups/$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Restoring from backup: $BACKUP_FILE"
    
    # Stop container
    docker-compose stop pocketbase
    
    # Copy backup to container
    docker cp "./backups/$BACKUP_FILE" fitclash-pocketbase:/pb_data/backup.zip
    
    # Start container
    docker-compose start pocketbase
    
    # Wait for container to be ready
    sleep 5
    
    # Restore backup
    docker-compose exec pocketbase /usr/local/bin/pocketbase restore /pb_data/backup.zip --confirm
    
    # Clean up
    docker-compose exec pocketbase rm /pb_data/backup.zip
    
    log_success "Backup restored successfully!"
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Check if migration files exist
    if [ ! -f "./pocketbase/collections_schema.json" ]; then
        log_error "Migration file not found: ./pocketbase/collections_schema.json"
        exit 1
    fi
    
    log_info "Please import the schema manually:"
    log_info "1. Go to http://localhost:8090/_/"
    log_info "2. Navigate to Settings > Import/Export"
    log_info "3. Import collections_schema.json"
    
    # Open browser (macOS)
    if command -v open > /dev/null; then
        open "http://localhost:8090/_/"
    fi
}

# Access container shell
access_shell() {
    log_info "Accessing PocketBase container shell..."
    docker-compose exec pocketbase /bin/sh
}

# Clean up (DESTRUCTIVE)
cleanup() {
    log_warning "This will remove all containers and volumes. ALL DATA WILL BE LOST!"
    read -p "Are you sure? Type 'YES' to confirm: " CONFIRM
    
    if [ "$CONFIRM" != "YES" ]; then
        log_info "Cleanup cancelled."
        exit 0
    fi
    
    log_info "Removing containers and volumes..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    
    log_success "Cleanup completed!"
}

# Main script
check_docker

case "$1" in
    start)
        start_containers "$2"
        ;;
    stop)
        stop_containers
        ;;
    restart)
        restart_containers
        ;;
    logs)
        show_logs
        ;;
    backup)
        create_backup
        ;;
    restore)
        restore_backup
        ;;
    migrate)
        run_migrations
        ;;
    shell)
        access_shell
        ;;
    clean)
        cleanup
        ;;
    prod)
        start_containers "prod"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
