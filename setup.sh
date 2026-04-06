#!/bin/bash
# Setup script for Bengali Math SQLite local environment

echo "Setting up Bengali Math SQLite environment..."

# Install Python dependencies for the database service
echo "Installing Python dependencies..."
cd service/db
pip install -r requirements.txt
pip install python-dotenv anthropic

# Check if database exists
cd ../..
if [ -f "database/bengali_curriculam.db" ]; then
    echo "✓ Database file exists at database/bengali_curriculam.db"
else
    echo "⚠ Database file not found. It will be created when you run the API."
fi

echo ""
echo "Setup complete! To start the server:"
echo "  cd service/db"
echo "  python api.py"
echo ""
echo "The API will run on http://localhost:3002"
