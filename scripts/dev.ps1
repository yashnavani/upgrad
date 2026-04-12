# Development helper script for Windows PowerShell

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "Master Foundation Development Helper" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\dev.ps1 <command>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Green
    Write-Host "  start       - Start all services"
    Write-Host "  stop        - Stop all services"
    Write-Host "  restart     - Restart all services"
    Write-Host "  logs        - View logs (all services)"
    Write-Host "  logs-be     - View backend logs"
    Write-Host "  logs-fe     - View frontend logs"
    Write-Host "  health      - Check service health"
    Write-Host "  rebuild     - Rebuild and restart services"
    Write-Host "  clean       - Stop services and remove volumes (WARNING: deletes data)"
    Write-Host "  migrate     - Run database migrations"
    Write-Host "  test        - Run backend tests"
    Write-Host "  shell-be    - Open backend container shell"
    Write-Host "  shell-db    - Open database shell"
    Write-Host "  status      - Show container status"
    Write-Host ""
}

function Start-Services {
    Write-Host "Starting all services..." -ForegroundColor Green
    docker compose up -d
    Write-Host ""
    Write-Host "Services started! Waiting for health checks..." -ForegroundColor Green
    Start-Sleep -Seconds 5
    Check-Health
}

function Stop-Services {
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    docker compose down
}

function Restart-Services {
    Write-Host "Restarting all services..." -ForegroundColor Yellow
    docker compose restart
}

function Show-Logs {
    docker compose logs -f
}

function Show-BackendLogs {
    docker compose logs -f backend
}

function Show-FrontendLogs {
    docker compose logs -f frontend
}

function Check-Health {
    Write-Host "Checking service health..." -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Backend Health:" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/health" -UseBasicParsing
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  Status: $($json.status)" -ForegroundColor Green
        Write-Host "  Environment: $($json.environment)"
        Write-Host "  Database: $($json.database)"
    } catch {
        Write-Host "  Backend not responding" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Frontend Health:" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 5
        Write-Host "  Status: OK" -ForegroundColor Green
    } catch {
        Write-Host "  Frontend not responding" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Container Status:" -ForegroundColor Yellow
    docker compose ps
}

function Rebuild-Services {
    Write-Host "Rebuilding services..." -ForegroundColor Yellow
    docker compose up -d --build
}

function Clean-All {
    Write-Host "WARNING: This will delete all data!" -ForegroundColor Red
    $confirmation = Read-Host "Are you sure? (yes/no)"
    if ($confirmation -eq "yes") {
        Write-Host "Cleaning up..." -ForegroundColor Yellow
        docker compose down -v
        Write-Host "Cleanup complete" -ForegroundColor Green
    } else {
        Write-Host "Cancelled" -ForegroundColor Yellow
    }
}

function Run-Migrations {
    Write-Host "Running database migrations..." -ForegroundColor Green
    docker compose exec backend alembic upgrade head
}

function Run-Tests {
    Write-Host "Running backend tests..." -ForegroundColor Green
    docker compose exec backend pytest
}

function Open-BackendShell {
    Write-Host "Opening backend shell..." -ForegroundColor Cyan
    docker compose exec backend bash
}

function Open-DatabaseShell {
    Write-Host "Opening database shell..." -ForegroundColor Cyan
    docker compose exec database psql -U postgres -d master_foundation
}

function Show-Status {
    Write-Host "Container Status:" -ForegroundColor Cyan
    docker compose ps
}

# Main command dispatcher
switch ($Command.ToLower()) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "logs" { Show-Logs }
    "logs-be" { Show-BackendLogs }
    "logs-fe" { Show-FrontendLogs }
    "health" { Check-Health }
    "rebuild" { Rebuild-Services }
    "clean" { Clean-All }
    "migrate" { Run-Migrations }
    "test" { Run-Tests }
    "shell-be" { Open-BackendShell }
    "shell-db" { Open-DatabaseShell }
    "status" { Show-Status }
    default { Show-Help }
}
