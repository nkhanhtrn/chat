# Dual Sync Architecture Design

**Version:** 1.0
**Status:** Proposed
**Author:** Claude
**Date:** 2026-01-09

---

## 📋 Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Architecture](#architecture)
- [Sync Granularity](#sync-granularity)
- [Change Tracking](#change-tracking)
- [Sync Flow](#sync-flow)
- [Conflict Resolution](#conflict-resolution)
- [Performance Optimizations](#performance-optimizations)
- [Implementation Plan](#implementation-plan)
- [Testing Strategy](#testing-strategy)

---

## 🎯 Overview

### Goals

1. **Local-First:** App works fully offline, instant UI updates
2. **Cloud Sync:** Cross-device synchronization when online
3. **Efficient:** Minimal data transfer and Firestore operations
4. **Reliable:** Handle conflicts, network failures, and edge cases
5. **Performant:** Don't block UI, batch operations

### Non-Goals

- Real-time collaborative editing (not required)
- Operational transformation (too complex for use case)
- Peer-to-peer sync (cloud-centric is fine)

---

## 🏗️ Design Principles

### 1. Local-First Architecture

```
User Action → Local Store (Instant) → IndexedDB (Fast) → Cloud (Background)
              ↓
              UI Updates Immediately
```

**Benefits:**
- Instant feedback
- Works offline
- No network latency

### 2. Per-Notebook Granularity

Sync at the **notebook level** (not message-level, not global):

**Why?**
- ✅ Balance between efficiency and simplicity
- ✅ Notebooks are independent units (good boundary)
- ✅ Reduces conflict potential (users typically work in one notebook)
- ✅ Easier to implement than message-level
- ✅ More efficient than full-state sync

**Structure:**
```
users/{userId}/notebooks/{notebookId}
  ├── metadata (document)
  │   ├── id: string
  │   ├── name: string
  │   ├── createdAt: timestamp
  │   ├── updatedAt: timestamp
  │   ├── lastSyncedAt: timestamp
  │   ├── scratchpad: string
  │   └── messageCount: number
  │
  └── messages (subcollection)
      ├── {messageId1}
      ├── {messageId2}
      └── ...

users/{userId}/metadata (document)
  ├── currentNotebookId: string
  ├── notebookOrder: string[]
  ├── vocabData: object
  ├── lastViewedContent: object
  └── updatedAt: timestamp
```

### 3. Change Tracking with Dirty Flags

Track what changed since last sync:

```javascript
{
  notebookId: {
    isDirty: true,           // Notebook has unsaved changes
    dirtyFields: Set([        // What changed
      'name',
      'scratchpad'
    ]),
    dirtyMessages: Set([      // Which messages changed
      'msg-123',
      'msg-456'
    ]),
    deletedMessages: Set([    // Which messages deleted
      'msg-789'
    ]),
    lastSyncedAt: 1704844800000
  }
}
```

### 4. Optimistic Updates

```
1. User makes change
2. Update local state immediately (UI updates)
3. Mark as dirty
4. Save to IndexedDB (< 50ms)
5. Queue for cloud sync (background)
6. Sync when possible (debounced, batched)
```

---

## 🏛️ Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                          UI Layer                            │
│                  (Vue Components + Store)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  SyncManager  │ ← Central orchestrator
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
│ LocalStorage │    │ChangeTracker│    │ CloudSync   │
│   Manager    │    │             │    │   Manager   │
└───────┬──────┘    └──────┬──────┘    └──────┬──────┘
        │                   │                   │
┌───────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
│  IndexedDB   │    │ Dirty Flags │    │  Firestore  │
└──────────────┘    └─────────────┘    └─────────────┘
```

### Class Structure

```javascript
// Central orchestrator
class SyncManager {
  constructor(store, options)

  // Public API
  async initialize()
  async saveNotebook(notebookId)
  async syncNotebook(notebookId, force = false)
  async syncAll()
  async pullFromCloud()

  // Event handlers
  onLocalChange(notebookId, changes)
  onCloudChange(notebookId, data)
}

// Local storage operations
class LocalStorageManager {
  async saveNotebook(notebookId, data)
  async loadNotebook(notebookId)
  async deleteNotebook(notebookId)
  async loadAllNotebooks()
}

// Track changes per notebook
class ChangeTracker {
  markNotebookDirty(notebookId, field)
  markMessageDirty(notebookId, messageId)
  markMessageDeleted(notebookId, messageId)
  getDirtyNotebooks()
  clearDirty(notebookId)
  isNotebookDirty(notebookId)
}

// Cloud sync operations
class CloudSyncManager {
  async pushNotebook(notebookId, data, changes)
  async pullNotebook(notebookId)
  async pullAllNotebooks()
  async deleteNotebook(notebookId)
  subscribeToNotebook(notebookId, callback)
}
```

---

## 📦 Sync Granularity

### What Gets Synced Per Notebook

**Metadata (Document):**
- Notebook name
- Scratchpad content
- Creation/update timestamps
- Message count

**Messages (Subcollection):**
- Individual messages (only changed ones)
- Highlights and notes
- Question links
- Parent-child relationships

**Global Data (Separate Document):**
- Vocabulary cards (all in one doc)
- Current notebook ID
- Notebook order
- Last viewed content

### Sync Frequency

| Trigger | Action | Delay |
|---------|--------|-------|
| User edits | Mark dirty | Immediate |
| Save to local | IndexedDB write | < 50ms |
| Sync to cloud | Debounced | 2-5 seconds |
| Batch sync | Multiple notebooks | 30 seconds |
| Pull from cloud | On app start | Once |
| Real-time listener | Cloud changes | Immediate |

---

## 🔄 Sync Flow

### 1. User Makes Change (Write Path)

```javascript
// User action: Add message, edit text, etc.
chatStore.addMessage(message)
  ↓
// Store mutation (instant)
messagesById[id] = message
  ↓
// Mark dirty (instant)
changeTracker.markNotebookDirty(notebookId, 'messages')
changeTracker.markMessageDirty(notebookId, messageId)
  ↓
// Save to IndexedDB (fast, ~50ms)
localStorageManager.saveNotebook(notebookId, data)
  ↓
// Queue cloud sync (debounced, 2-5 seconds)
syncManager.queueSync(notebookId)
  ↓
// Background: Sync to cloud when ready
cloudSyncManager.pushNotebook(notebookId, data, changes)
```

**Timeline:**
- **0ms:** User clicks
- **0-10ms:** Store updates, UI renders
- **10-50ms:** IndexedDB write completes
- **2000-5000ms:** Cloud sync triggers
- **2100-5500ms:** Cloud sync completes

### 2. App Startup (Read Path)

```javascript
// On app load
syncManager.initialize()
  ↓
// Load from IndexedDB first (fast)
const localData = await localStorageManager.loadAllNotebooks()
store.applyState(localData)
  ↓
// UI renders immediately with local data
  ↓
// Background: Pull from cloud (slower)
const cloudData = await cloudSyncManager.pullAllNotebooks()
  ↓
// Merge if needed (handle conflicts)
syncManager.mergeCloudData(cloudData)
  ↓
// Update UI if there were cloud changes
store.applyState(mergedData)
```

**Timeline:**
- **0-100ms:** Load from IndexedDB
- **100ms:** UI renders with local data
- **500-2000ms:** Cloud data arrives
- **2000ms:** UI updates if changes

### 3. Cross-Device Sync

**Device A makes change:**
```
Device A: Edit message → Local → IndexedDB → Cloud
                                              ↓
Device B: ← Cloud listener fires → Merge → IndexedDB → Store → UI
```

**With real-time listeners:**
- Device B gets updates within 1-3 seconds
- No polling required
- Efficient (only changed notebooks)

---

## 🤝 Conflict Resolution

### Strategy: Last-Write-Wins with Timestamps

**Why?**
- Simple to implement
- Works for 95% of cases
- Single-user app (low conflict probability)

### Conflict Types

#### 1. Notebook-Level Conflicts

**Scenario:** Same notebook edited on two devices

**Detection:**
```javascript
if (cloudData.updatedAt > localData.lastSyncedAt) {
  // Cloud is newer
} else if (localData.updatedAt > cloudData.lastSyncedAt) {
  // Local is newer
}
```

**Resolution:**
- Compare `updatedAt` timestamps
- Newer wins
- Backup older version (optional)

#### 2. Message-Level Conflicts

**Scenario:** Same message edited on two devices (rare)

**Resolution:**
- Per-message timestamps
- Newer message wins
- Preserve both as branches (optional advanced feature)

#### 3. Metadata Conflicts

**Scenario:** Notebook renamed on two devices

**Resolution:**
```javascript
// Field-level merge
{
  name: cloudData.updatedAt > localData.updatedAt
    ? cloudData.name
    : localData.name,
  scratchpad: // ... same logic
}
```

### User-Facing Conflict UI

**For important conflicts:**
```
┌─────────────────────────────────────────┐
│  Sync Conflict Detected                 │
├─────────────────────────────────────────┤
│  Notebook "Research" was edited on      │
│  another device.                        │
│                                         │
│  ○ Keep this device's changes           │
│  ○ Use other device's changes           │
│  ○ Merge both (advanced)                │
│                                         │
│     [Cancel]  [Resolve]                 │
└─────────────────────────────────────────┘
```

**For minor conflicts:**
- Auto-resolve (newer wins)
- Log to console
- Show toast notification

---

## ⚡ Performance Optimizations

### 1. Debouncing

```javascript
// Don't sync on every keystroke
const debouncedSync = debounce((notebookId) => {
  syncManager.syncNotebook(notebookId)
}, 3000) // 3 second delay

// Usage
store.$subscribe((mutation) => {
  const notebookId = mutation.payload.notebookId
  debouncedSync(notebookId)
})
```

### 2. Batching

```javascript
// Sync multiple notebooks in one batch
class SyncManager {
  constructor() {
    this.syncQueue = new Set()
    this.batchInterval = 30000 // 30 seconds
  }

  queueSync(notebookId) {
    this.syncQueue.add(notebookId)
    // Process queue after interval
  }

  async processBatch() {
    const notebooks = Array.from(this.syncQueue)
    // Use Firestore batch writes
    const batch = writeBatch(db)
    for (const notebookId of notebooks) {
      // Add to batch
    }
    await batch.commit()
  }
}
```

### 3. Incremental Sync

```javascript
// Only sync changed messages, not entire notebook
async pushNotebook(notebookId, data, changes) {
  const batch = writeBatch(db)

  // Update metadata only if changed
  if (changes.dirtyFields.size > 0) {
    batch.update(notebookRef, metadataUpdates)
  }

  // Update only dirty messages
  for (const messageId of changes.dirtyMessages) {
    batch.set(messageRef(messageId), messagesById[messageId])
  }

  // Delete removed messages
  for (const messageId of changes.deletedMessages) {
    batch.delete(messageRef(messageId))
  }

  await batch.commit()
}
```

### 4. Compression

```javascript
// Compress large message content before storing
import { compress, decompress } from 'lz-string'

async saveMessage(message) {
  if (message.response.length > 10000) {
    message.responseCompressed = compress(message.response)
    delete message.response
  }
  await db.put(message)
}
```

### 5. Background Sync

```javascript
// Use Web Worker for heavy operations
class SyncWorker {
  async syncInBackground(data) {
    // Serialize, compress, upload in worker thread
    // Don't block main thread
  }
}
```

### 6. Smart Pulling

```javascript
// Only pull notebooks that changed on cloud
async pullChangedNotebooks() {
  // Query Firestore for notebooks with updatedAt > lastPulledAt
  const query = notebooksRef.where(
    'updatedAt',
    '>',
    lastPulledAt
  )
  const snapshot = await getDocs(query)
  // Only download changed notebooks
}
```

---

## 🛠️ Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Set up infrastructure

- [ ] Create `SyncManager` class
- [ ] Create `ChangeTracker` class
- [ ] Create `LocalStorageManager` class (refactor existing)
- [ ] Create `CloudSyncManager` class (refactor existing)
- [ ] Add dirty flags to store state
- [ ] Write unit tests for each class

**Files to Create:**
- `src/services/sync/SyncManager.js`
- `src/services/sync/ChangeTracker.js`
- `src/services/sync/LocalStorageManager.js`
- `src/services/sync/CloudSyncManager.js`
- `src/services/sync/types.js` (TypeScript definitions)

### Phase 2: Local Storage Migration (Week 2)

**Goal:** Migrate to per-notebook storage

- [ ] Update `ChatStorage.js` to save per-notebook
- [ ] Implement notebook-level IndexedDB operations
- [ ] Migrate existing data to new structure
- [ ] Update store to use new storage API
- [ ] Test offline functionality

**Migration Script:**
```javascript
// Migrate from single-state to per-notebook
async function migrateToPerNotebookStorage() {
  const oldState = await ChatStorage.loadState()

  for (const notebook of oldState.chats) {
    const notebookData = extractNotebookData(oldState, notebook.id)
    await localStorageManager.saveNotebook(notebook.id, notebookData)
  }

  // Save global data
  await localStorageManager.saveGlobalData({
    vocabData: oldState.vocabData,
    currentNotebookId: oldState.currentChatId
  })
}
```

### Phase 3: Change Tracking (Week 3)

**Goal:** Track what changed

- [ ] Integrate `ChangeTracker` into store
- [ ] Mark dirty on every mutation
- [ ] Implement dirty flag persistence
- [ ] Add dirty state to UI (optional indicator)
- [ ] Test change tracking accuracy

**Store Integration:**
```javascript
// In chat.js store
actions: {
  addMessage(message) {
    // ... existing code

    // Mark as dirty
    changeTracker.markNotebookDirty(this.currentChatId, 'messages')
    changeTracker.markMessageDirty(this.currentChatId, message.id)

    // Save locally
    this._persistNotebook(this.currentChatId)

    // Queue cloud sync
    syncManager.queueSync(this.currentChatId)
  }
}
```

### Phase 4: Cloud Sync Integration (Week 4)

**Goal:** Connect to Firestore

- [ ] Update Firestore schema to per-notebook structure
- [ ] Implement push (local → cloud)
- [ ] Implement pull (cloud → local)
- [ ] Add debouncing and batching
- [ ] Test with real Firebase project

**Firestore Structure:**
```javascript
// Create notebook in Firestore
async pushNotebook(notebookId, data, changes) {
  const notebookRef = doc(
    db,
    'users', userId,
    'notebooks', notebookId
  )

  // Batch write for atomicity
  const batch = writeBatch(db)

  // Update metadata
  batch.set(notebookRef, {
    id: data.id,
    name: data.name,
    scratchpad: data.scratchpad,
    updatedAt: serverTimestamp(),
    messageCount: data.rootMessageIds.length
  }, { merge: true })

  // Update messages
  for (const msgId of changes.dirtyMessages) {
    const msgRef = doc(
      notebookRef,
      'messages', msgId
    )
    batch.set(msgRef, data.messagesById[msgId])
  }

  await batch.commit()
}
```

### Phase 5: Conflict Resolution (Week 5)

**Goal:** Handle conflicts gracefully

- [ ] Implement timestamp-based conflict detection
- [ ] Implement auto-resolution (last-write-wins)
- [ ] Add conflict UI for important cases
- [ ] Test with multiple devices
- [ ] Add conflict logging and monitoring

**Conflict Detection:**
```javascript
async mergeCloudData(cloudData) {
  const localData = await localStorageManager.loadNotebook(notebookId)

  if (!localData) {
    // No local data, accept cloud
    return cloudData
  }

  if (cloudData.updatedAt <= localData.lastSyncedAt) {
    // Local is newer, keep local
    return localData
  }

  if (localData.updatedAt <= cloudData.lastSyncedAt) {
    // Cloud is newer, accept cloud
    return cloudData
  }

  // Both changed since last sync - conflict!
  return await this.resolveConflict(localData, cloudData)
}
```

### Phase 6: Real-Time Sync (Week 6)

**Goal:** Push updates across devices

- [ ] Implement Firestore listeners per notebook
- [ ] Handle incoming changes while user is active
- [ ] Debounce listener updates
- [ ] Test cross-device sync
- [ ] Add online/offline indicators

**Listener Setup:**
```javascript
class CloudSyncManager {
  subscribeToNotebook(notebookId, callback) {
    const notebookRef = doc(
      db,
      'users', userId,
      'notebooks', notebookId
    )

    return onSnapshot(notebookRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data()
        callback(cloudData)
      }
    })
  }

  subscribeToAllNotebooks(callback) {
    const notebooksRef = collection(
      db,
      'users', userId,
      'notebooks'
    )

    return onSnapshot(notebooksRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          callback(change.doc.id, change.doc.data())
        }
      })
    })
  }
}
```

### Phase 7: Optimization & Polish (Week 7-8)

**Goal:** Production-ready

- [ ] Add compression for large messages
- [ ] Implement smart pulling (only changed notebooks)
- [ ] Add retry logic for failed syncs
- [ ] Add sync status indicators
- [ ] Performance testing and optimization
- [ ] Add analytics/monitoring
- [ ] Documentation

---

## 🧪 Testing Strategy

### Unit Tests

```javascript
describe('ChangeTracker', () => {
  it('marks notebook as dirty when message added')
  it('tracks dirty messages correctly')
  it('clears dirty state after sync')
})

describe('SyncManager', () => {
  it('debounces rapid changes')
  it('batches multiple notebooks')
  it('handles sync failures gracefully')
})

describe('CloudSyncManager', () => {
  it('pushes only changed messages')
  it('pulls latest data from cloud')
  it('handles network errors')
})
```

### Integration Tests

```javascript
describe('End-to-end sync', () => {
  it('syncs new notebook to cloud')
  it('syncs changes from cloud to local')
  it('resolves conflicts correctly')
  it('works offline and syncs when online')
})
```

### Manual Testing Scenarios

1. **Offline Mode:**
   - Disconnect from network
   - Make changes
   - Reconnect
   - Verify sync happens

2. **Cross-Device:**
   - Open app on two devices
   - Edit same notebook
   - Verify real-time sync

3. **Conflict:**
   - Edit same message on two devices offline
   - Bring both online
   - Verify conflict resolution

4. **Performance:**
   - Create 100 notebooks with 100 messages each
   - Measure sync time
   - Should be < 5 seconds for initial sync

---

## 📊 Success Metrics

### Performance Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Local save | < 50ms | < 100ms | > 100ms |
| Cloud sync (1 notebook) | < 500ms | < 1s | > 2s |
| Initial pull (100 notebooks) | < 3s | < 5s | > 10s |
| Conflict resolution | < 1s | < 2s | > 5s |
| UI responsiveness | 60 FPS | 30 FPS | < 30 FPS |

### Reliability Targets

- **Sync success rate:** > 99.9%
- **Data loss:** 0% (with proper backups)
- **Conflict rate:** < 1% of syncs
- **Auto-resolution rate:** > 95% of conflicts

---

## 🔐 Security Considerations

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own notebooks
    match /users/{userId}/notebooks/{notebookId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;

      // Messages subcollection
      match /messages/{messageId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId;
      }
    }

    // Global user metadata
    match /users/{userId}/metadata {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

### Data Validation

```javascript
// Validate data before syncing
function validateNotebook(data) {
  if (!data.id || typeof data.id !== 'string') {
    throw new Error('Invalid notebook ID')
  }

  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Invalid notebook name')
  }

  // Validate messages
  for (const [id, message] of Object.entries(data.messagesById)) {
    if (!message.role || !message.content) {
      throw new Error(`Invalid message: ${id}`)
    }
  }
}
```

---

## 💰 Cost Estimation (Firestore)

### Operations

**Assumptions:**
- 1 user
- 10 notebooks
- Average 50 messages per notebook
- 10 edits per day per notebook
- 30 days per month

**Reads:**
- Initial load: 10 notebooks × 50 messages = 500 reads/session
- 2 sessions/day = 1,000 reads/day
- Monthly: 30,000 reads

**Writes:**
- 10 edits/day × 10 notebooks = 100 writes/day
- Monthly: 3,000 writes

**Cost:**
- Reads: 30,000 × $0.036/100,000 = $0.01
- Writes: 3,000 × $0.108/100,000 = $0.003
- Storage: ~10MB × $0.18/GB = $0.002
- **Total: ~$0.02/month** (basically free)

---

## 🚀 Rollout Plan

### Stage 1: Internal Testing (Week 1-2)
- Enable for developer account only
- Test all scenarios
- Fix critical bugs

### Stage 2: Beta Testing (Week 3-4)
- Enable for 10-20 beta users
- Monitor errors and performance
- Collect feedback

### Stage 3: Gradual Rollout (Week 5-6)
- Enable for 25% of users
- Monitor metrics
- Enable for 50% of users
- Enable for 100% of users

### Stage 4: Post-Launch (Week 7+)
- Monitor and optimize
- Fix reported issues
- Add advanced features

---

## 📚 References

- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Offline Data Persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Local-First Software](https://www.inkandswitch.com/local-first/)

---

## ✅ Summary

**Key Design Decisions:**

1. **Per-Notebook Granularity** - Balance between efficiency and simplicity
2. **Local-First** - Instant UI, works offline
3. **Change Tracking** - Only sync what changed
4. **Last-Write-Wins** - Simple conflict resolution
5. **Debounced Sync** - Batch operations for performance
6. **Real-Time Listeners** - Cross-device updates within seconds

**Implementation Timeline:** 7-8 weeks

**Expected Performance:** < 50ms local saves, < 500ms cloud sync

**Cost:** ~$0.02/month per user (negligible)

