#!/bin/bash
set -e  # exit on any error

# -------------------------------
# DDSC-Service Local CI/CD Script
# -------------------------------

# 1️⃣ Variables
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M")
IMAGE_NAME="node-app-local"
IMAGE_TAG="node-app-uat-${TIMESTAMP}"
CONTAINER_NAME="node-app"
ENV_FILE=".uat.env"
HOST_PORT=3000

# 🔥 Read APP_PORT from .uat.env
CONTAINER_PORT=$(grep -E '^APP_PORT=' ${ENV_FILE} | cut -d '=' -f2)

if [ -z "$CONTAINER_PORT" ]; then
  echo "❌ APP_PORT not found in ${ENV_FILE}"
  exit 1
fi

echo "-----------------------------"
echo "Starting DDSC-Service Deployment"
echo "Timestamp: $TIMESTAMP"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo "Container: $CONTAINER_NAME"
echo "Env file: $ENV_FILE"
echo "Container Port (APP_PORT): $CONTAINER_PORT"
echo "Host Port: $HOST_PORT"
echo "-----------------------------"

# 2️⃣ Build Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# 3️⃣ Stop old container if exists
echo "Stopping old container (if exists)..."
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true

# 4️⃣ Run new container
echo "Running new container..."
docker run -d \
  --name ${CONTAINER_NAME} \
  --env-file ${ENV_FILE} \
  -p ${HOST_PORT}:${CONTAINER_PORT} \
  --restart unless-stopped \
  ${IMAGE_NAME}:${IMAGE_TAG}

echo "-----------------------------"
echo "✅ DDSC-Service is now running!"
echo "🌐 Access your app at http://<server-ip>:${HOST_PORT}"
echo "📜 Logs: docker logs -f ${CONTAINER_NAME}"
echo "-----------------------------"
