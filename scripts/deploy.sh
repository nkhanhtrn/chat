#!/bin/bash

# Deploy to GitHub Pages
set -e

echo "Running type check..."
npm run type-check

echo "Running tests..."
npx vitest run

echo "Building application..."
npm run build

echo "Building reader..."
npm run build:reader

echo "Staging reader under dist/reader..."
mkdir -p dist/reader
cp -r dist-reader/* dist/reader/

echo "Adding .nojekyll file..."
touch dist/.nojekyll

echo "Deploying to gh-pages..."
npx gh-pages -d dist --no-history --dotfiles

echo "Deployment complete!"
