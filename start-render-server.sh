#!/bin/bash

echo "Setting up video rendering server..."

# Change to server directory
cd server

# Install dependencies
echo "Installing server dependencies..."
npm install

# Start the server
echo "Starting rendering server..."
PORT=3031 node index.js