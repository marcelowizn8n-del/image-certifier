#!/bin/bash

# Image Certifier - Automated Deployment Script
# This script commits changes and deploys to Hostinger VPS

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration file
CONFIG_FILE="$(dirname "$0")/.deploy-config"

echo -e "${GREEN}🚀 Image Certifier - Automated Deployment${NC}"
echo "================================================"

# Load or create configuration
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo -e "${GREEN}✓${NC} Loaded existing configuration"
else
    echo -e "${YELLOW}⚠${NC}  First time setup - please provide VPS details:"
    echo ""
    
    read -p "VPS Hostname/IP (e.g., srv1085365.hstgr.cloud): " VPS_HOST
    read -p "SSH Username (default: root): " VPS_USER
    VPS_USER=${VPS_USER:-root}
    read -p "Project path on VPS (e.g., /root/image-certifier): " VPS_PATH
    VPS_PATH=${VPS_PATH:-/root/image-certifier}
    read -p "SSH Key path (default: ~/.ssh/id_ed25519): " SSH_KEY
    SSH_KEY=${SSH_KEY:-~/.ssh/id_ed25519}
    
    # Save configuration
    cat > "$CONFIG_FILE" << EOF
VPS_HOST="$VPS_HOST"
VPS_USER="$VPS_USER"
VPS_PATH="$VPS_PATH"
SSH_KEY="$SSH_KEY"
EOF
    
    echo -e "${GREEN}✓${NC} Configuration saved to $CONFIG_FILE"
fi

# Expand tilde in SSH_KEY path
SSH_KEY="${SSH_KEY/#\~/$HOME}"

# Verify SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}✗${NC} SSH key not found: $SSH_KEY"
    exit 1
fi

echo ""
echo "Deployment Configuration:"
echo "  Host: $VPS_USER@$VPS_HOST"
echo "  Path: $VPS_PATH"
echo "  Key:  $SSH_KEY"
echo ""

# Step 1: Git commit
echo -e "${YELLOW}📝 Committing changes...${NC}"
if [[ -n $(git status -s) ]]; then
    git add .
    read -p "Commit message (or press Enter for default): " COMMIT_MSG
    COMMIT_MSG=${COMMIT_MSG:-"Auto-deploy: $(date '+%Y-%m-%d %H:%M:%S')"}
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓${NC} Changes committed"
else
    echo -e "${GREEN}✓${NC} No changes to commit"
fi

# Step 2: Test SSH connection
echo ""
echo -e "${YELLOW}🔐 Testing SSH connection...${NC}"
if ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST" "echo 'Connection successful'"; then
    echo -e "${GREEN}✓${NC} SSH connection successful"
else
    echo -e "${RED}✗${NC} SSH connection failed"
    exit 1
fi

# Step 3: Build locally (optional but recommended to ensure it works)
# echo ""
# echo -e "${YELLOW}🏗 Building locally...${NC}"
# npm run build

# Step 4: Sync files to VPS
echo ""
echo -e "${YELLOW}📦 Syncing files to VPS...${NC}"

# Ensure remote directory exists
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "mkdir -p $VPS_PATH"

rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '.expo' \
    --exclude '*.zip' \
    -e "ssh -i $SSH_KEY" \
    ./ "$VPS_USER@$VPS_HOST:$VPS_PATH/"

echo -e "${GREEN}✓${NC} Files synced successfully"

# Step 5: Deploy on VPS
echo ""
echo -e "${YELLOW}🚀 Restarting application on VPS...${NC}"

ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" << ENDSSH
set -e
cd "$VPS_PATH" || exit 1

echo "Installing dependencies..."
npm install --production

echo "Building application..."
npm run build

echo "Restarting service..."
# Use PM2 if available, otherwise fallback to standard restart
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart all || pm2 start dist/index.cjs --name "image-certifier"
else
    echo "PM2 not found. Please ensure application is running."
fi

echo ""
echo "✓ Deployment complete!"
ENDSSH

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
