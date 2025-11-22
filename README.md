# Chat

A chat interface built with Vue.js that connects to LM Studio API.

## Features

- 🗂️ **Multiple Chat Tabs** - Create and manage different chat conversations
- 🤖 **Model Selection** - Choose from available AI models via dropdown
- 💬 **Chat Interface** - Clean, modern chat UI
- 🔌 **LM Studio Integration** - Full integration with LM Studio API endpoints

## LM Studio API Endpoints Used

- `GET /v1/models` - Fetch available models
- `POST /v1/chat/completions` - Chat with AI models
- `POST /v1/completions` - Text completions
- `POST /v1/embeddings` - Generate embeddings
- `POST /v1/responses` - Custom responses

## Prerequisites

1. **LM Studio** installed and running
   - Download from [lmstudio.ai](https://lmstudio.ai/)
   - Start the local server (default: `http://localhost:1234`)
   - Load at least one model

2. **Node.js** (v16 or higher)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Configuration

The API base URL is configured in `src/services/api.js`. By default, it points to:
```javascript
const API_BASE_URL = 'http://localhost:1234'
```

If your LM Studio server runs on a different port, update this URL.

## Usage

1. **Start LM Studio** and ensure the local server is running with a model loaded
2. **Launch the app** with `npm run dev`
3. **Select a model** from the dropdown in the sidebar
4. **Create a new chat** by clicking "+ New Chat"
5. **Type your message** and press Enter or click Send
6. **Switch between chats** by clicking on different chat tabs
7. **Delete chats** by clicking the × button on a chat tab

## Project Structure

```
chat-clone/
├── src/
│   ├── components/
│   │   └── ChatView.vue       # Main chat interface component
│   ├── services/
│   │   └── api.js             # LM Studio API integration
│   ├── App.vue                # Root component with tabs & model selector
│   ├── main.js                # Application entry point
│   └── style.css              # Global styles
├── index.html                 # HTML template
├── vite.config.js             # Vite configuration
└── package.json               # Dependencies
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Troubleshooting

### Models not loading
- Ensure LM Studio is running and the server is started
- Check that the API_BASE_URL in `api.js` matches your LM Studio server address
- Verify that at least one model is loaded in LM Studio

### CORS issues
- LM Studio's local server should allow CORS by default
- If you encounter issues, check LM Studio's server settings

### Connection refused
- Make sure LM Studio's local server is running
- Check that the port matches (default is 1234)

## License

MIT
