#!/bin/bash

# Exit on error
set -e

echo "🧪 Running tests..."
npm test -- --run

echo "📊 Generating test coverage..."
npm run test:coverage

echo "🏗️  Building application..."
npm run build

echo "📝 Adding test coverage to README..."

# Extract coverage summary from the coverage output
COVERAGE_FILE="./coverage/coverage-summary.json"

if [ -f "$COVERAGE_FILE" ]; then
  # Extract coverage percentages using node
  LINES=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
  STATEMENTS=$(node -e "console.log(require('./coverage/coverage-summary.json').total.statements.pct)")
  FUNCTIONS=$(node -e "console.log(require('./coverage/coverage-summary.json').total.functions.pct)")
  BRANCHES=$(node -e "console.log(require('./coverage/coverage-summary.json').total.branches.pct)")
  
  echo "Coverage: Lines: ${LINES}%, Statements: ${STATEMENTS}%, Functions: ${FUNCTIONS}%, Branches: ${BRANCHES}%"
  
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
  
  # Replace placeholders in the gh-pages README template
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
  }' > dist/README.md
  
  # Copy the HTML coverage report to dist
  if [ -d "coverage" ]; then
    cp -r coverage dist/
    echo "✅ HTML coverage report copied to dist/coverage/"
  fi
  
  echo "✅ README with coverage added to dist/"
else
  echo "⚠️  Coverage summary not found, copying original README"
  cp README.md dist/README.md
fi

echo "🚀 Deploying to gh-pages..."
npx gh-pages -d dist

echo "✨ Deployment complete!"
