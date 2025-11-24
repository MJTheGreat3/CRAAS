.PHONY: help install dev prod build clean test logs

# Default target
help:
	@echo "CRAS - Contamination Risk Analysis & Alert System"
	@echo ""
	@echo "Available commands:"
	@echo "  install     - Install all dependencies"
	@echo "  dev         - Start development environment"
	@echo "  prod        - Start production environment"
	@echo "  build       - Build Docker images"
	@echo "  clean       - Clean up containers and volumes"
	@echo "  test        - Run tests"
	@echo "  logs        - Show logs from all services"
	@echo "  db-shell    - Open database shell"
	@echo "  db-reset    - Reset database (WARNING: deletes all data)"
	@echo ""

# Install dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Dependencies installed successfully!"

# Development environment
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.dev.yml up --build

# Production environment
prod:
	@echo "Starting production environment..."
	docker-compose up --build -d

# Build Docker images
build:
	@echo "Building Docker images..."
	docker-compose build

# Clean up
clean:
	@echo "Cleaning up containers and volumes..."
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f

# Run tests
test:
	@echo "Running backend tests..."
	cd backend && python -m pytest tests/ -v
	@echo "Running frontend tests..."
	cd frontend && npm test -- --coverage --watchAll=false

# Show logs
logs:
	docker-compose logs -f

# Database shell
db-shell:
	docker-compose exec postgres psql -U cras_user -d cras_db

# Reset database
db-reset:
	@echo "WARNING: This will delete all data. Are you sure? [y/N]"
	@read -r confirm && [ "$$confirm" = "y" ] || exit 1
	docker-compose down -v
	docker-compose up -d postgres
	sleep 10
	@echo "Database reset complete!"

# Development shortcuts
dev-backend:
	cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm start

# Production shortcuts
prod-build:
	@echo "Building for production..."
	docker-compose -f docker-compose.yml build --no-cache

prod-deploy:
	@echo "Deploying to production..."
	docker-compose -f docker-compose.yml up -d --build

# Database management
db-backup:
	docker-compose exec postgres pg_dump -U cras_user cras_db > backup_$(shell date +%Y%m%d_%H%M%S).sql

db-restore:
	@echo "Usage: make db-restore BACKUP_FILE=backup.sql"
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Error: BACKUP_FILE parameter required"; exit 1; fi
	docker-compose exec -T postgres psql -U cras_user cras_db < $(BACKUP_FILE)

# Monitoring
status:
	docker-compose ps

health:
	@echo "Checking service health..."
	curl -f http://localhost:8000/health || echo "Backend unhealthy"
	curl -f http://localhost:3000 || echo "Frontend unhealthy"

# SSL certificate generation (for production)
ssl-generate:
	@echo "Generating self-signed SSL certificate..."
	mkdir -p nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/ssl/key.pem \
		-out nginx/ssl/cert.pem \
		-subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
	@echo "SSL certificate generated in nginx/ssl/"
