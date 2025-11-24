import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import App from '../App.vue'
import SettingModal from '../components/SettingModal.vue'
import DownloadLink from '../components/DownloadLink.vue'
import * as storage from '../services/storage.js'
import * as api from '../services/api.js'

vi.mock('../services/api.js', () => ({
  fetchModels: vi.fn(),
  setApiBaseUrl: vi.fn(),
  sendChatMessage: vi.fn()
}))

vi.mock('../services/storage.js', () => ({
  loadAllData: vi.fn(() => ({})),
  saveChats: vi.fn(),
  saveActiveChat: vi.fn(),
  saveSelectedModel: vi.fn(),
  saveChatCounter: vi.fn(),
  loadApiConfig: vi.fn(),
  saveApiConfig: vi.fn(),
  loadWebsiteContext: vi.fn(() => null),
  saveWebsiteContext: vi.fn(),
  deleteWebsiteContext: vi.fn(),
  saveSidebarState: vi.fn(),
  loadSidebarState: vi.fn(() => false)
}))

describe('App.vue Download Button', () => {
  let wrapper
  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
    wrapper = mount(App, {
      global: {
        stubs: {
          ChatView: true,
          ChatThread: true
        }
      },
      attachTo: document.body
    })
  })

  it('should render DownloadLink component', () => {
    const downloadLink = wrapper.findComponent(DownloadLink)
    expect(downloadLink.exists()).toBe(true)
  })

  it('should trigger downloadChats and set downloadUrl/filename', async () => {
    // Open modal
    wrapper.vm.showApiModal = true
    await wrapper.vm.$nextTick()
    // Simulate SettingModal emits download-chats
    const modal = wrapper.findComponent(SettingModal)
    await modal.vm.$emit('download-chats')
    await wrapper.vm.$nextTick()
    // downloadUrl and downloadFilename should be set
    expect(wrapper.vm.downloadUrl).toMatch(/^blob:/)
    expect(wrapper.vm.downloadFilename).toMatch(/^chat-messages-/)
  })

  it('should set correct href and download attributes on <a> after downloadChats is called', async () => {
    await wrapper.vm.downloadChats()
    await wrapper.vm.$nextTick()
    const downloadLink = wrapper.findComponent(DownloadLink)
    const a = downloadLink.find('a')
    expect(a.attributes('href')).toBe(wrapper.vm.downloadUrl)
    expect(a.attributes('download')).toBe(wrapper.vm.downloadFilename)
  })
})
