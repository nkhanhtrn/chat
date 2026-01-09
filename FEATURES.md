# Feature Inventory

**Last Updated:** 2026-01-09
**Test Coverage:** 96.59%
**Status:** Production-ready for local/offline use

---

## 📋 Table of Contents

- [Implemented Features](#implemented-features)
- [Incomplete Work](#incomplete-work)
- [Architecture Overview](#architecture-overview)
- [Technical Stack](#technical-stack)
- [Routes](#routes)

---

## ✅ Implemented Features

### 1. Core Chat System
**Files:** `src/stores/chat.js`, `src/views/ChatView.vue`

- Multi-conversation chat interface
- Message tree structure with branching conversations
- Streaming response support
- Message navigation and history (navigate between branches)
- Scratchpad for note-taking during conversations
- Token usage tracking
- Message deletion and editing

**Status:** ✅ Complete

---

### 2. Studio Mode (Advanced AI Interface)
**Files:** `src/views/StudioChat.vue`, `src/composables/studio/`

- Advanced AI chat interface with multiple capabilities
- Canvas panel for visual outputs and tools
- Session management with tabs
- Output windows for code/visualizations
- Planning capability for multi-step tasks
- Web search integration
- Tool instance store with persistence
- Multiple LLM provider support:
  - Google AI (Gemini)
  - Cerebras
  - LM Studio (local)
  - Code API
- Two-model mode (router + executor)

**Status:** ✅ Complete

---

### 3. Books Library & Reader
**Files:** `src/stores/books.js`, `src/views/BooksLibrary.vue`, `src/views/BookViewer.vue`

- EPUB book management and reading
- PDF support via pdfjs-dist
- Book preloading system with progress tracking
- Book metadata (title, author, cover generation)
- Table of contents navigation
- Book-to-notebook linking
- Color-based and alphabetical sorting
- Public library integration (external library search)
- Reading progress tracking per device
- Highlight synchronization

**Status:** ✅ Complete

---

### 4. Notebook System
**Files:** `src/views/NotebooksPage.vue`

- Multiple notebooks for organizing conversations
- Question/answer organization
- Search functionality across notebooks
- Move questions between notebooks
- Notebook metadata (title, description, color)

**Status:** ✅ Complete

---

### 5. Highlighting & Annotation System
**Files:** `src/composables/useHighlights.js`, `src/components/Note.vue`

- Text highlighting in 5 colors:
  - Yellow (#ffeb3b)
  - Green (#4caf50)
  - Blue (#2196f3)
  - Pink (#ff4081)
  - Orange (#ff9800)
- Note-taking on highlights
- Context menu for highlight operations
- Vocabulary card creation from highlights
- Highlight persistence and sync

**Status:** ✅ Complete

---

### 6. Vocabulary & Spaced Repetition
**Files:** `src/stores/VocabCard.js`, `src/composables/useVocabulary.js`

- Vocabulary card management
- Spaced repetition system (SM-2 algorithm)
- Review scheduling
- Integration with highlights
- Card difficulty tracking
- Review history

**Status:** ✅ Complete

---

### 7. Calendar Feature
**Files:** `src/views/CalendarPage.vue`

- Calendar view for organizing content
- Day modal for daily entries
- Date-based content navigation

**Status:** ✅ Complete

---

### 8. LLM Capabilities System
**Files:** `src/services/llm/capabilities/`

Modular capability system for different AI tasks:

- **BaseCapability.js** - Foundation for all capabilities
- **BuildCapability.js** - UI building and dynamic components
- **CodeCapability.js** - Code generation and execution
- **PlanningCapability.js** - Multi-step task planning
- **TextResponseCapability.js** - Standard text responses
- **VisualizationCapability.js** - Charts and visual data (ECharts)
- **WebSearchCapability.js** - Web search integration
- **CapabilityRegistry.js** - Capability management and routing

**Status:** ✅ Complete

---

### 9. Storage & Persistence
**Files:** `src/services/`

Multi-layer storage architecture:

- **ChatStorage.js** - Chat state persistence
- **BookStorage.js** - Book data storage
- **StudioStorage.js** - Studio session storage
- **indexedDB.js** - IndexedDB wrapper for large data
- **settings.js** - Settings management (localStorage)
- Firebase integration (infrastructure ready, currently disabled)

**Storage Layers:**
- localStorage: Settings, preferences, lightweight data
- IndexedDB: Books, attachments, studio sessions, large data
- Firestore (disabled): Cloud sync infrastructure

**Status:** ✅ Complete (Firebase intentionally disabled)

---

### 10. File Attachment System
**Files:** `src/services/attachmentReader.js`, `src/composables/useAttachments.js`

- URL fetching and content extraction
- PDF reading and text extraction
- EPUB reading and content extraction
- Image attachments
- URL preview generation
- File size validation
- Type detection

**Status:** ✅ Complete

---

### 11. Markdown & Rendering
**Files:** `src/services/ASTMarkdownRenderer.js`, `src/components/markdown/`

Custom AST-based markdown renderer with:

- Code blocks with syntax highlighting (Prism.js)
- Math rendering (KaTeX)
- Mermaid diagrams
- Table support
- Highlight spans
- Question link spans
- Custom component rendering
- Streaming support (partial markdown rendering)

**Status:** ✅ Complete

---

### 12. Dynamic Tool System
**Files:** `src/components/ToolElement.vue`, `src/composables/useDynamicCompiler.js`

- Dynamic Vue component compilation at runtime
- Tool element rendering:
  - Text inputs
  - Selects/dropdowns
  - Checkboxes
  - Color pickers
  - Sliders
  - Buttons
- Proxied fetch for tools (CORS bypass)
- Tool state persistence
- Real-time tool updates

**Status:** ✅ Complete

---

### 13. Authentication & Cloud Sync
**Files:** `src/services/auth.js`, `src/services/firestore/`

Infrastructure for cloud synchronization:

- Firebase authentication system
- Cloud sync for:
  - Books and reading progress
  - Chats and conversations
  - Studio sessions
  - Highlights
- Conflict resolution system (basic)
- Firestore security rules defined

**Status:** 🟡 Infrastructure Complete, Intentionally Disabled
- All code exists and is ready
- Currently using local storage only
- Can be enabled by uncommenting in `src/main.js`

---

### 14. Settings & Themes
**Files:** `src/services/settings.js`, `src/theme/`

- Three themes:
  - Light
  - Dark
  - Sepia
- LLM provider configuration
- API key management (secure storage)
- Model selection per provider
- Category-based model mapping
- Custom library URL configuration
- Settings persistence

**Status:** ✅ Complete

---

### 15. Web Search Integration
**Files:** `src/services/webSearch.js`

- External web search integration
- Search result parsing
- Progress tracking
- Error handling
- Streaming search updates

**Status:** ✅ Complete

---

## ⚠️ Incomplete Work

### High Priority

#### 1. Production URL Structure
**File:** `src/components/markdown/QuestionLinkSpan.vue:170`

```javascript
// TODO: Update URL structure if production doesn't contain /chat/
return `/chat/#/notebook/${notebookId}/q/${props.targetMessageId}`
```

**Issue:** Question links assume `/chat/` base path. May need adjustment for production deployment.

**Impact:** Low - Only affects question link navigation in different deployment contexts.

---

#### 2. Conflict Resolution Placeholder
**File:** `src/stores/books.js:490-491`

```javascript
async resolveConflict(bookId, choice) {
  // Placeholder for conflict resolution
  this.syncConflicts = this.syncConflicts.filter(c => c.bookId !== bookId)
  // Re-sync after resolution
  await this.syncToCloud(true)
}
```

**Issue:** Conflict resolution simply removes conflicts without implementing merge logic.

**Impact:** Low - Only relevant when cloud sync is enabled. Currently cloud sync is disabled.

**Possible Solutions:**
- Implement "keep local" vs "keep remote" logic
- Add "merge manually" option with UI
- Implement automatic merge strategies (latest wins, etc.)

---

### Low Priority

#### 3. Build Capability Test Data
**File:** `src/services/llm/capabilities/BuildCapability.js:221`

Contains example/test data in capability definitions. Not a bug, but could be cleaned up.

---

## 🏗️ Architecture Overview

### Project Structure

```
chat/
├── src/
│   ├── components/          # 40+ reusable components
│   │   ├── Modal/          # 11 modal components
│   │   ├── markdown/       # Markdown rendering components
│   │   └── studio/         # Studio mode components (16 files)
│   ├── views/              # 8 main page views
│   ├── stores/             # 4 Pinia stores
│   ├── services/           # 20+ service modules
│   │   ├── llm/           # LLM providers & capabilities
│   │   └── firestore/     # Cloud sync (currently disabled)
│   ├── composables/        # 11+ composables
│   ├── utils/              # 6 utility modules
│   ├── router/             # Vue Router configuration
│   └── theme/              # Theme definitions
├── firestore.rules         # Firestore security rules
└── tests/                  # Comprehensive test suite
```

### Key Services

1. **LMService.js** - Main LLM service orchestrator
   - Provider management
   - Category-based model selection
   - Request routing

2. **taskRouter.js** - Routes tasks to appropriate capabilities
   - Analyzes user intent
   - Selects appropriate capability
   - Handles fallbacks

3. **responseParser.js** - Parses LLM responses
   - XML tag parsing
   - Content extraction
   - Multi-part response handling

4. **ASTMarkdownRenderer.js** - Custom markdown rendering
   - AST-based parsing
   - Streaming support
   - Component rendering

5. **urlFetcher.js** - External URL fetching
   - Proxy support for CORS bypass
   - Content extraction
   - Error handling

6. **backupRestore.js** - Data backup/restore
   - Export all data
   - Import with validation
   - Migration support

### Data Flow

```
User Input
    ↓
ChatView/StudioChat
    ↓
LMService (provider selection)
    ↓
taskRouter (capability selection)
    ↓
Capability (BuildCapability, CodeCapability, etc.)
    ↓
Response Parser
    ↓
Markdown Renderer
    ↓
UI Update
    ↓
Storage (ChatStorage, IndexedDB)
```

### Storage Strategy

- **Settings:** localStorage (small, fast access)
- **Chat State:** IndexedDB (large, structured)
- **Books:** IndexedDB (files can be large)
- **Studio Sessions:** IndexedDB (complex state)
- **Cloud Sync:** Firestore (when enabled)

---

## 🛠️ Technical Stack

### Frontend Framework
- **Vue 3** - Composition API
- **Vue Router** - Client-side routing
- **Pinia** - State management

### Build Tools
- **Vite** - Build tool and dev server
- **Vite PWA** - Progressive Web App support

### Content Rendering
- **markdown-it** - Markdown parsing
- **marked** - Alternative markdown parser
- **KaTeX** - Math rendering
- **Mermaid** - Diagram rendering
- **Prism.js** - Syntax highlighting

### Data Visualization
- **ECharts** - Charts and visualizations

### Book Reading
- **epubjs** - EPUB rendering
- **pdfjs-dist** - PDF rendering

### Storage
- **idb** - IndexedDB wrapper
- **Firebase** - Authentication & Firestore (disabled)

### Testing
- **Vitest** - Test runner
- **@vue/test-utils** - Vue component testing
- **happy-dom** - DOM simulation

### Utilities
- **cytoscape** - Graph visualization
- **file-saver** - File downloads
- **jszip** - ZIP file handling

---

## 🗺️ Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Landing.vue` | Landing page |
| `/notebooks` | `NotebooksPage.vue` | Notebooks overview |
| `/studio` | `StudioChat.vue` | Studio chat interface |
| `/calendar` | `CalendarPage.vue` | Calendar view |
| `/books` | `BooksLibrary.vue` | Books library |
| `/books/:id` | `BookViewer.vue` | Book reader |
| `/current/:type/:id` | `CurrentContentView.vue` | Current content view |
| `/current/:type/:id/q/:questionId` | `CurrentContentView.vue` | Content with question |
| `/notebook/:id` | `NotebookView.vue` | Notebook view |
| `/notebook/:id/q/:questionId` | `QuestionView.vue` | Question view |

---

## 📊 Test Coverage

**Overall:** 96.59%

### Well-Tested Areas
- Core chat functionality
- Message tree navigation
- Studio capabilities
- Markdown rendering
- Component interactions
- Store mutations
- Router navigation

### Testing Tools
- Unit tests with Vitest
- Component tests with Vue Test Utils
- Mock implementations for Firebase
- Happy-dom for DOM simulation

---

## 🚀 Deployment Considerations

### Current State
- **Mode:** Local-first, offline-capable
- **Storage:** IndexedDB + localStorage
- **Cloud Sync:** Disabled

### To Enable Cloud Sync

1. Uncomment Firebase initialization in `src/main.js`
2. Configure Firebase project credentials
3. Deploy Firestore security rules from `firestore.rules`
4. Test conflict resolution
5. Update URL structure TODO if needed

### Production Checklist
- [ ] Review question link URLs for production path
- [ ] Test cloud sync thoroughly
- [ ] Implement conflict resolution UI
- [ ] Set up Firebase project
- [ ] Configure API keys securely
- [ ] Test all LLM providers
- [ ] Review CSP and CORS policies
- [ ] Test PWA offline functionality

---

## 📝 Notes

### Design Decisions

1. **Local-First Architecture:** App works fully offline with IndexedDB
2. **Category-Based LLM Selection:** Models selected by task type (FREE, QUICK, DETAILS, REASONING)
3. **Modular Capabilities:** Each AI capability is independent and pluggable
4. **AST Markdown Rendering:** Custom renderer for streaming and component support
5. **Firebase Optional:** Cloud sync is entirely optional, not required

### Known Limitations

1. URL fetching requires proxy for CORS (intentional security measure)
2. Dynamic component compilation has performance overhead
3. Large books may take time to load into IndexedDB

### Future Enhancements (Potential)

- [ ] Mobile app (Capacitor/Ionic)
- [ ] Collaboration features (shared notebooks)
- [ ] Advanced conflict resolution UI
- [ ] Book annotations export (PDF/highlights)
- [ ] Voice input support
- [ ] Multi-language support
- [ ] Plugin system for custom capabilities

---

## 🆘 Support

For issues or questions:
1. Check test files for usage examples
2. Review component documentation in source
3. Check console logs with debug mode enabled

---

**Maintained by:** Khanh Tran
**Repository:** /home/user/chat
**License:** (Not specified)
