# Chat

![Coverage](https://img.shields.io/badge/coverage-96.59%25-brightgreen)

## Quick Start

1. Install [LM Studio](https://lmstudio.ai/) and start the local server
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests with Vitest
- `npm run test:coverage` - Run tests with coverage
- `npm run deploy` - Deploy to GitHub Pages

## Features

- Multiple chat conversations
- Model selection dropdown
- LocalStorage persistence
- Markdown rendering with syntax highlighting

## Configuration

Configure API settings in the app or edit `src/services/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:1234'
```