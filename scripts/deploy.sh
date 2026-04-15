#!/bin/bash

# Deploy to GitHub Pages
set -e

echo "Running type check..."
npm run type-check

echo "Building application..."
npm run build

echo "Adding .nojekyll file..."
touch dist/.nojekyll

echo "Deploying to gh-pages..."
npx gh-pages -d dist --no-history --dotfiles

echo "Deployment complete!"
