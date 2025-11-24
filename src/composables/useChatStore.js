import { ref, computed } from 'vue'

// Global chat state store (simple version, can be replaced with Pinia)
const chats = ref([])
const activeChatId = ref(null)

const activeChat = computed(() => chats.value.find(c => c.id === activeChatId.value))

function setChats(newChats) {
  chats.value = newChats
}

function setActiveChat(id) {
  activeChatId.value = id
}

function addChat(chat) {
  chats.value.push(chat)
}

function updateChat(id, updater) {
  const idx = chats.value.findIndex(c => c.id === id)
  if (idx !== -1) {
    updater(chats.value[idx])
  }
}

export function useChatStore() {
  return {
    chats,
    activeChatId,
    activeChat,
    setChats,
    setActiveChat,
    addChat,
    updateChat
  }
}
