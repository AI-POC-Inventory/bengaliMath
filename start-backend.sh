#!/bin/bash
# Start the Bengali Math backend with SQLite

echo "Starting Bengali Math API server..."
echo "Database: database/bengali_curriculam.db"
echo "API URL: http://localhost:3002"
echo ""

cd service/db && python api.py
