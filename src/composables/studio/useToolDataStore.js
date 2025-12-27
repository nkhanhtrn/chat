/**
 * Tool Data Store - Per-tool localStorage-backed CRUD operations
 *
 * Provides isolated data storage for each tool, identified by tool name.
 * Data persists to localStorage and survives page refreshes.
 */

const STORAGE_PREFIX = 'tool-data-'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export function useToolDataStore(toolName) {
  const storageKey = STORAGE_PREFIX + toolName

  function loadData() {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch (e) {
      console.error('Error loading tool data:', e)
      return {}
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch (e) {
      console.error('Error saving tool data:', e)
    }
  }

  /**
   * Create a new record
   * @param {Object} record - The data to store
   * @returns {Object} The created record with id
   */
  function create(record) {
    const data = loadData()
    const id = generateId()
    const newRecord = { id, ...record, _createdAt: Date.now() }
    data[id] = newRecord
    saveData(data)
    return newRecord
  }

  /**
   * Read record(s)
   * @param {string} [id] - Optional record ID. If omitted, returns all records as array.
   * @returns {Object|Array} Single record or array of all records
   */
  function read(id) {
    const data = loadData()
    if (id) {
      return data[id] || null
    }
    // Return as sorted array (newest first)
    return Object.values(data).sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
  }

  /**
   * Update an existing record
   * @param {string} id - Record ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated record or null if not found
   */
  function update(id, updates) {
    const data = loadData()
    if (!data[id]) {
      return null
    }
    data[id] = { ...data[id], ...updates, _updatedAt: Date.now() }
    saveData(data)
    return data[id]
  }

  /**
   * Delete a record
   * @param {string} id - Record ID
   * @returns {boolean} True if deleted, false if not found
   */
  function remove(id) {
    const data = loadData()
    if (!data[id]) {
      return false
    }
    delete data[id]
    saveData(data)
    return true
  }

  /**
   * Query records with a predicate function
   * @param {Function} predicate - Filter function (record) => boolean
   * @returns {Array} Matching records
   */
  function query(predicate) {
    const all = read()
    return all.filter(predicate)
  }

  /**
   * Clear all records for this tool
   */
  function clear() {
    saveData({})
  }

  /**
   * Get count of records
   * @returns {number} Number of records
   */
  function count() {
    return Object.keys(loadData()).length
  }

  return {
    create,
    read,
    update,
    delete: remove, // 'delete' is reserved keyword
    query,
    clear,
    count
  }
}
