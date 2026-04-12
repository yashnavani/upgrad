#!/bin/bash
# Development helper script for Linux/Mac

set -e

COMMAND=${1:-help}

show_help() {
    echo -e "\033[36mMaster Foundation Development Helper\033[0m"
    echo ""
    echo -e "\033[33mUsage: ./scripts/dev.sh <command>\033[0m"
    echo ""
    echo -e "\033[32mCommands:\033[0m"
    echo "  start       - Start all services"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  logs        - View logs (all services)"
    echo "  logs-be     - View backend logs"
    echo "  logs-fe     - View frontend logs"
    echo "  health      - Check service health"
    echo "  rebuild     - Rebuild and restart services"
    echo "  clean       - Stop services and remove volumes (WARNING: deletes data)"
    echo "  migrate     - Run database migrations"
    echo "  test        - Run backend tests"
    echo "  shell-be    - Open backend container shell"
    echo "  shell-db    - Open database shell"
    echo "  status      - Show container status"
    echo ""
}

start_services() {
    echo -e "\033[32mStarting all services...\033[0m"
    docker compose up -d
    echo ""
    echo -e "\033[32mServices started! Waiting for health checks...\033[0m"
    sleep 5
    check_health
}

stop_services() {
    echo -e "\033[33mStopping all services...\033[0m"
    docker compose down
}

restart_services() {
    echo -e "\033[33mRestarting all services...\033[0m"
    docker compose restart
}

show_logs() {
    docker compose logs -f
}

show_backend_logs() {
    docker compose logs -f backend
}

show_frontend_logs() {
    docker compose logs -f frontend
}

check_health() {
    echo -e "\033[36mChecking service health...\033[0m"
    echo ""
    
    echo -e "\033[33mBackend Health:\033[0m"
    if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        curl -s http://localhost:8000/api/v1/health | jq '.'
    else
        echo -e "\033[31m  Backend not responding\033[0m"
    fi
    
    echo ""
    echo -e "\033[33mFrontend Health:\033[0m"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200"; then
        echo -e "\033[32m  Status: OK\033[0m"
    else
        echo -e "\033[31m  Frontend not responding\033[0m"
    fi
    
    echo ""
    echo -e "\033[33mContainer Status:\033[0m"
    docker compose ps
}

rebuild_services() {
    echo -e "\033[33mRebuilding services...\033[0m"
    docker compose up -d --build
}

clean_all() {
    echo -e "\033[31mWARNING: This will delete all data!\033[0m"
    read -p "Are you sure? (yes/no): " confirmation
    if [ "$confirmation" = "yes" ]; then
        echo -e "\033[33mCleaning up...\033[0m"
        docker compose down -v
        echo -e "\033[32mCleanup complete\033[0m"
    else
        echo -e "\033[33mCancelled\033[0m"
    fi
}

run_migrations() {
    echo -e "\033[32mRunning database migrations...\033[0m"
    docker compose exec backend alembic upgrade head
}

run_tests() {
    echo -e "\033[32mRunning backend tests...\033[0m"
    docker compose exec backend pytest
}

open_backend_shell() {
    echo -e "\033[36mOpening backend shell...\033[0m"
    docker compose exec backend bash
}

open_database_shell() {
    echo -e "\033[36mOpening database shell...\033[0m"
    docker compose exec database psql -U postgres -d master_foundation
}

show_status() {
    echo -e "\033[36mContainer Status:\033[0m"
    docker compose ps
}

# Main command dispatcher
case "$COMMAND" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        show_logs
        ;;
    logs-be)
        show_backend_logs
        ;;
    logs-fe)
        show_frontend_logs
        ;;
    health)
        check_health
        ;;
    rebuild)
        rebuild_services
        ;;
    clean)
        clean_all
        ;;
    migrate)
        run_migrations
        ;;
    test)
        run_tests
        ;;
    shell-be)
        open_backend_shell
        ;;
    shell-db)
        open_database_shell
        ;;
    status)
        show_status
        ;;
    *)
        show_help
        ;;
esac
