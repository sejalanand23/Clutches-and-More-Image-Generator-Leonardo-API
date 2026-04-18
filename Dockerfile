# Use official Python 3.11 image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (needed for some image libraries or networking)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage Docker cache
COPY requirements_cloud.txt .
RUN pip install --no-cache-dir -r requirements_cloud.txt

# Copy the rest of the application code
# We exclude things in .dockerignore (like frontend and venv)
COPY . .

# Set the PYTHONPATH so the backend can find the 'src' directory
ENV PYTHONPATH=/app

# Expose the port (Cloud Run sets this automatically via $PORT)
# We default to 8080 if not set
ENV PORT=8080

# Start command
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
