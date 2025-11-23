#!/bin/bash

# Test deployment script (dry run)
# This script tests the deployment process without actually pushing to gh-pages

set -e

echo "🧪 Running tests..."
npm test -- --run

echo "📊 Generating test coverage..."
npm run test:coverage

echo "🏗️  Building application..."
npm run build

echo "📝 Generating README with test coverage..."

COVERAGE_FILE="coverage/coverage-summary.json"

if [ -f "$COVERAGE_FILE" ]; then
  LINES=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
  STATEMENTS=$(node -e "console.log(require('./coverage/coverage-summary.json').total.statements.pct)")
  FUNCTIONS=$(node -e "console.log(require('./coverage/coverage-summary.json').total.functions.pct)")
  BRANCHES=$(node -e "console.log(require('./coverage/coverage-summary.json').total.branches.pct)")
  
  echo "✅ Coverage extracted:"
  echo "   Lines: ${LINES}%"
  echo "   Statements: ${STATEMENTS}%"
  echo "   Functions: ${FUNCTIONS}%"
  echo "   Branches: ${BRANCHES}%"
  
  # Generate per-file coverage table
  FILE_COVERAGE=$(node -e "
    const coverage = require('./coverage/coverage-summary.json');
    let table = '| File | Lines | Statements | Functions | Branches |\\n';
    table += '|------|-------|------------|-----------|----------|\\n';
    
    Object.keys(coverage)
      .filter(key => key !== 'total')
      .sort()
      .forEach(file => {
        const filePath = file.replace(process.cwd() + '/', '');
        const stats = coverage[file];
        table += \`| \${filePath} | \${stats.lines.pct}% | \${stats.statements.pct}% | \${stats.functions.pct}% | \${stats.branches.pct}% |\\n\`;
      });
    
    console.log(table);
  ")
  
  # Generate the README that would be created
  echo ""
  echo "📄 README.md preview:"
  echo "========================================"
  sed -e "s/{{LINES}}/${LINES}/g" \
      -e "s/{{STATEMENTS}}/${STATEMENTS}/g" \
      -e "s/{{FUNCTIONS}}/${FUNCTIONS}/g" \
      -e "s/{{BRANCHES}}/${BRANCHES}/g" \
      -e "s|{{DATE}}|$(date -u '+%Y-%m-%d %H:%M:%S UTC')|g" \
      README.gh-pages.md | \
  awk -v coverage="$FILE_COVERAGE" '{
    if ($0 ~ /{{FILE_COVERAGE}}/) {
      print coverage
    } else {
      print $0
    }
  }'
  echo "========================================"
  echo ""
  echo "✅ Dry run complete! Everything looks good."
  echo "🚀 Run 'npm run deploy' to deploy to gh-pages"
else
  echo "⚠️  Coverage summary not found"
  exit 1
fi
