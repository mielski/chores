# Use Python 3.11 slim image for smaller size
FROM python:3.11-slim

# Build argument for version (commit hash)
ARG APP_VERSION=unknown

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY src/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY src/ .

# Create directory for state file with proper permissions
RUN mkdir -p /app/data && chown -R 1001:1001 /app

# Use non-root user for security
USER 1001

# Expose port
EXPOSE 8080

# Environment variables
ENV PORT=8080
ENV STATE_FILE=/app/data/household_state.json
ENV PYTHONUNBUFFERED=1
ENV SECRET=""
ENV USERNAME=""
ENV PASSWORD=""
ENV APP_VERSION=${APP_VERSION}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Use gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
