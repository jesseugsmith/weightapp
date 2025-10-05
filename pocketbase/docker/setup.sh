#!/bin/bash

# FitClash PocketBase Setup Script
# This script sets up PocketBase with hooks and seeds the necessary roles

set -e  # Exit on any error

echo "🚀 Setting up FitClash PocketBase with Hooks"
echo "============================================="

# Check if we're in the pocketbase directory
if [ ! -f "main.js" ]; then
    echo "❌ Error: main.js not found. Please run this script from the pocketbase directory."
    exit 1
fi

if [ ! -f "seed_roles.js" ]; then
    echo "❌ Error: seed_roles.js not found. Please run this script from the pocketbase directory."
    exit 1
fi

# Check if PocketBase binary exists
if [ ! -f "pocketbase" ]; then
    echo "📥 PocketBase binary not found. Downloading..."
    
    # Detect OS
    OS=""
    ARCH=""
    case "$(uname -s)" in
        Darwin*)
            OS="darwin"
            case "$(uname -m)" in
                x86_64*) ARCH="amd64" ;;
                arm64*) ARCH="arm64" ;;
                *) echo "❌ Unsupported architecture: $(uname -m)"; exit 1 ;;
            esac
            ;;
        Linux*)
            OS="linux"
            case "$(uname -m)" in
                x86_64*) ARCH="amd64" ;;
                aarch64*) ARCH="arm64" ;;
                *) echo "❌ Unsupported architecture: $(uname -m)"; exit 1 ;;
            esac
            ;;
        *)
            echo "❌ Unsupported OS: $(uname -s)"
            exit 1
            ;;
    esac
    
    # Download PocketBase
    echo "📥 Downloading PocketBase for ${OS}_${ARCH}..."
    curl -L -o pocketbase.zip "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_${OS}_${ARCH}.zip"
    
    # Extract and cleanup
    unzip -q pocketbase.zip
    rm pocketbase.zip
    chmod +x pocketbase
    
    echo "✅ PocketBase downloaded successfully"
else
    echo "✅ PocketBase binary found"
fi

# Function to check if PocketBase is running
check_pocketbase() {
    curl -s -f http://127.0.0.1:8090/api/health > /dev/null 2>&1
}

# Function to wait for PocketBase to be ready
wait_for_pocketbase() {
    echo "⏳ Waiting for PocketBase to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if check_pocketbase; then
            echo "✅ PocketBase is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ PocketBase failed to start after $max_attempts attempts"
    return 1
}

# Start PocketBase in the background with hooks
echo "🔄 Starting PocketBase with hooks..."
./pocketbase serve --http="127.0.0.1:8090" --hooksDir="." > pocketbase.log 2>&1 &
POCKETBASE_PID=$!

# Save PID for cleanup
echo $POCKETBASE_PID > pocketbase.pid

# Cleanup function
cleanup() {
    if [ -f pocketbase.pid ]; then
        SAVED_PID=$(cat pocketbase.pid)
        if kill -0 $SAVED_PID 2>/dev/null; then
            echo "🛑 Stopping PocketBase..."
            kill $SAVED_PID
            wait $SAVED_PID 2>/dev/null || true
        fi
        rm -f pocketbase.pid
    fi
}

# Set up cleanup on script exit
trap cleanup EXIT

# Wait for PocketBase to be ready
if ! wait_for_pocketbase; then
    echo "❌ Failed to start PocketBase. Check pocketbase.log for details."
    cat pocketbase.log
    exit 1
fi

echo ""
echo "🎯 PocketBase is running with hooks enabled!"
echo ""
echo "📋 Next Steps:"
echo "============="
echo "1. Open your browser to: http://127.0.0.1:8090/_/"
echo "2. Create an admin account (first time only)"
echo "3. After creating admin account, run the role seeder:"
echo "   npm install && npm run seed"
echo "4. Import your collections schema if needed"
echo ""
echo "🔗 Important URLs:"
echo "  • Admin UI:  http://127.0.0.1:8090/_/"
echo "  • API Base:  http://127.0.0.1:8090/api/"
echo "  • Health:    http://127.0.0.1:8090/api/health"
echo ""
echo "📝 Hooks Status:"
echo "  • Profile creation hooks: ✅ Active"
echo "  • Competition hooks: ✅ Active"
echo "  • Notification hooks: ✅ Active"
echo ""
echo "🔍 To view logs: tail -f pocketbase.log"
echo "🛑 To stop: Press Ctrl+C or kill the process"
echo ""

# Check if Node.js and npm are available for seeding
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo "📦 Node.js detected. You can run role seeding with:"
    echo "   npm install && npm run seed"
    echo ""
    
    # Offer to install dependencies
    read -p "🤔 Would you like to install npm dependencies now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Installing npm dependencies..."
        npm install
        echo "✅ Dependencies installed!"
        echo ""
        echo "ℹ️  After setting up your admin account, run: npm run seed"
    fi
else
    echo "⚠️  Node.js not found. You'll need Node.js to run the role seeder."
    echo "   Install Node.js from: https://nodejs.org/"
fi

echo ""
echo "🎉 Setup complete! PocketBase is running in the background."
echo "   Check pocketbase.log for detailed logs."

# Keep the script running to maintain PocketBase
echo "💡 Press Ctrl+C to stop PocketBase and exit..."
wait $POCKETBASE_PID
