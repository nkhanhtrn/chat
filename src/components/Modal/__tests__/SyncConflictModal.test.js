import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SyncConflictModal from '../SyncConflictModal.vue'
import Modal from '../Modal.vue'
import * as storageModule from '../../../services/storage.js'

// Mock the storage module
vi.mock('../../../services/storage.js', () => ({
  forceUploadToCloud: vi.fn()
}))

describe('SyncConflictModal', () => {
  const mockLocalData = {
    messagesById: {
      msg1: { id: 'msg1', question: 'Local message 1' },
      msg2: { id: 'msg2', question: 'Local message 2' }
    },
    chats: [
      { id: 'chat1', rootMessageIds: ['msg1'] },
      { id: 'chat2', rootMessageIds: ['msg2'] }
    ],
    lastUpdated: 1700000000000 // Nov 14, 2023
  }

  const mockCloudData = {
    messagesById: {
      msg3: { id: 'msg3', question: 'Cloud message' }
    },
    chats: [
      { id: 'chat3', rootMessageIds: ['msg3'] }
    ],
    lastUpdated: 1700100000000 // Nov 15, 2023
  }

  const mountComponent = (props = {}) => {
    return mount(SyncConflictModal, {
      props: {
        visible: true,
        localData: mockLocalData,
        cloudData: mockCloudData,
        ...props
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
  }

  describe('rendering', () => {
    it('renders when visible is true', () => {
      const wrapper = mountComponent()

      expect(wrapper.find('.conflict-container').exists()).toBe(true)
    })

    it('does not render when visible is false', () => {
      const wrapper = mountComponent({ visible: false })

      expect(wrapper.find('.conflict-container').exists()).toBe(false)
    })

    it('displays both data options', () => {
      const wrapper = mountComponent()

      const options = wrapper.findAll('.data-option')
      expect(options).toHaveLength(2)
    })

    it('shows local data icon and title', () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      expect(localOption.find('.option-icon').text()).toContain('💻')
      expect(localOption.find('.option-title').text()).toBe('Local Data')
    })

    it('shows cloud data icon and title', () => {
      const wrapper = mountComponent()

      const cloudOption = wrapper.findAll('.data-option')[1]
      expect(cloudOption.find('.option-icon').text()).toContain('☁️')
      expect(cloudOption.find('.option-title').text()).toBe('Cloud Data')
    })

    it('displays correct notebook count for local data', () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      expect(localOption.find('.option-stats').text()).toContain('2 notebooks')
    })

    it('displays correct message count for local data', () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      expect(localOption.find('.option-stats').text()).toContain('2 messages')
    })

    it('displays correct notebook count for cloud data', () => {
      const wrapper = mountComponent()

      const cloudOption = wrapper.findAll('.data-option')[1]
      expect(cloudOption.find('.option-stats').text()).toContain('1 notebooks')
    })

    it('displays correct message count for cloud data', () => {
      const wrapper = mountComponent()

      const cloudOption = wrapper.findAll('.data-option')[1]
      expect(cloudOption.find('.option-stats').text()).toContain('1 messages')
    })

    it('displays formatted timestamp for local data', () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      const timestamp = localOption.find('.option-timestamp').text()
      // Should contain date string
      expect(timestamp).not.toBe('Unknown')
    })

    it('displays warning message', () => {
      const wrapper = mountComponent()

      expect(wrapper.find('.conflict-warning').text()).toContain('permanently overwritten')
    })

    it('shows confirm button disabled initially', () => {
      const wrapper = mountComponent()

      const confirmBtn = wrapper.find('.confirm-btn')
      expect(confirmBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('selection', () => {
    it('selects local option when clicked', async () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      await localOption.trigger('click')

      expect(localOption.classes()).toContain('selected')
    })

    it('selects cloud option when clicked', async () => {
      const wrapper = mountComponent()

      const cloudOption = wrapper.findAll('.data-option')[1]
      await cloudOption.trigger('click')

      expect(cloudOption.classes()).toContain('selected')
    })

    it('deselects previous option when new one is selected', async () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      const cloudOption = wrapper.findAll('.data-option')[1]

      await localOption.trigger('click')
      expect(localOption.classes()).toContain('selected')

      await cloudOption.trigger('click')
      expect(localOption.classes()).not.toContain('selected')
      expect(cloudOption.classes()).toContain('selected')
    })

    it('enables confirm button when option is selected', async () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      await localOption.trigger('click')

      const confirmBtn = wrapper.find('.confirm-btn')
      expect(confirmBtn.attributes('disabled')).toBeUndefined()
    })

    it('updates button text based on selection', async () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      await localOption.trigger('click')

      expect(wrapper.find('.confirm-btn').text()).toBe('Use Local Data')

      const cloudOption = wrapper.findAll('.data-option')[1]
      await cloudOption.trigger('click')

      expect(wrapper.find('.confirm-btn').text()).toBe('Use Cloud Data')
    })
  })

  describe('events', () => {
    it('emits resolve event with "local" when local is selected and confirmed', async () => {
      const wrapper = mountComponent()

      const localOption = wrapper.findAll('.data-option')[0]
      await localOption.trigger('click')

      const confirmBtn = wrapper.find('.confirm-btn')
      await confirmBtn.trigger('click')

      expect(wrapper.emitted('resolve')).toBeTruthy()
      expect(wrapper.emitted('resolve')[0]).toEqual(['local'])
    })

    it('emits resolve event with "cloud" when cloud is selected and confirmed', async () => {
      const wrapper = mountComponent()

      const cloudOption = wrapper.findAll('.data-option')[1]
      await cloudOption.trigger('click')

      const confirmBtn = wrapper.find('.confirm-btn')
      await confirmBtn.trigger('click')

      expect(wrapper.emitted('resolve')).toBeTruthy()
      expect(wrapper.emitted('resolve')[0]).toEqual(['cloud'])
    })

    it('does not emit resolve when no option is selected', async () => {
      const wrapper = mountComponent()

      const confirmBtn = wrapper.find('.confirm-btn')
      await confirmBtn.trigger('click')

      expect(wrapper.emitted('resolve')).toBeFalsy()
    })
  })

  describe('edge cases', () => {
    it('handles null localData gracefully', () => {
      const wrapper = mountComponent({ localData: null })

      const localOption = wrapper.findAll('.data-option')[0]
      expect(localOption.find('.option-stats').text()).toContain('0 notebooks')
      expect(localOption.find('.option-stats').text()).toContain('0 messages')
    })

    it('handles null cloudData gracefully', () => {
      const wrapper = mountComponent({ cloudData: null })

      const cloudOption = wrapper.findAll('.data-option')[1]
      expect(cloudOption.find('.option-stats').text()).toContain('0 notebooks')
      expect(cloudOption.find('.option-stats').text()).toContain('0 messages')
    })

    it('handles Firestore timestamp object', () => {
      const cloudDataWithFirestoreTimestamp = {
        ...mockCloudData,
        lastUpdated: {
          seconds: 1700100000,
          toDate: () => new Date(1700100000000)
        }
      }

      const wrapper = mountComponent({ cloudData: cloudDataWithFirestoreTimestamp })

      const cloudOption = wrapper.findAll('.data-option')[1]
      const timestamp = cloudOption.find('.option-timestamp').text()
      expect(timestamp).not.toBe('Unknown')
    })

    it('handles missing lastUpdated', () => {
      const dataWithoutTimestamp = {
        messagesById: {},
        chats: []
      }

      const wrapper = mountComponent({
        localData: dataWithoutTimestamp,
        cloudData: dataWithoutTimestamp
      })

      const options = wrapper.findAll('.data-option')
      expect(options[0].find('.option-timestamp').text()).toBe('Unknown')
      expect(options[1].find('.option-timestamp').text()).toBe('Unknown')
    })

    it('handles empty messagesById', () => {
      const emptyData = {
        messagesById: {},
        chats: [{ id: 'chat1' }],
        lastUpdated: Date.now()
      }

      const wrapper = mountComponent({ localData: emptyData })

      const localOption = wrapper.findAll('.data-option')[0]
      expect(localOption.find('.option-stats').text()).toContain('0 messages')
    })
  })

  describe('modal behavior', () => {
    it('passes preventClose prop to Modal', () => {
      const wrapper = mountComponent()

      const modal = wrapper.findComponent(Modal)
      expect(modal.props('preventClose')).toBe(true)
    })

    it('has correct title', () => {
      const wrapper = mountComponent()

      const modal = wrapper.findComponent(Modal)
      expect(modal.props('title')).toBe('Data Sync Conflict')
    })

    it('uses medium size modal', () => {
      const wrapper = mountComponent()

      const modal = wrapper.findComponent(Modal)
      expect(modal.props('size')).toBe('medium')
    })
  })

  describe('force upload functionality', () => {
    beforeEach(() => {
      vi.mocked(storageModule.forceUploadToCloud).mockReset()
    })

    it('renders force upload button', () => {
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      expect(forceUploadBtn.exists()).toBe(true)
      expect(forceUploadBtn.text()).toBe('Force Upload Local to Cloud')
    })

    it('renders force upload section with separator', () => {
      const wrapper = mountComponent()

      const section = wrapper.find('.force-upload-section')
      expect(section.exists()).toBe(true)
    })

    it('calls forceUploadToCloud when button is clicked', async () => {
      vi.mocked(storageModule.forceUploadToCloud).mockResolvedValue(true)
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')

      expect(storageModule.forceUploadToCloud).toHaveBeenCalled()
    })

    it('shows uploading state while upload is in progress', async () => {
      vi.mocked(storageModule.forceUploadToCloud).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      )
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')

      expect(forceUploadBtn.text()).toBe('Uploading...')
      expect(forceUploadBtn.attributes('disabled')).toBeDefined()
    })

    it('shows success status after successful upload', async () => {
      vi.mocked(storageModule.forceUploadToCloud).mockResolvedValue(true)
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')
      await wrapper.vm.$nextTick()

      const successStatus = wrapper.find('.upload-status.success')
      expect(successStatus.exists()).toBe(true)
      expect(successStatus.text()).toContain('Successfully uploaded')
    })

    it('shows error status after failed upload', async () => {
      vi.mocked(storageModule.forceUploadToCloud).mockRejectedValue(new Error('Upload failed'))
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')
      await wrapper.vm.$nextTick()

      const errorStatus = wrapper.find('.upload-status.error')
      expect(errorStatus.exists()).toBe(true)
      expect(errorStatus.text()).toContain('Upload failed')
    })

    it('emits resolve with "local" after successful upload', async () => {
      vi.useFakeTimers()
      vi.mocked(storageModule.forceUploadToCloud).mockResolvedValue(true)
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Advance timer to trigger the auto-resolve
      await vi.advanceTimersByTimeAsync(1500)

      expect(wrapper.emitted('resolve')).toBeTruthy()
      expect(wrapper.emitted('resolve')[0]).toEqual(['local'])
      vi.useRealTimers()
    })

    it('does not emit resolve after failed upload', async () => {
      vi.useFakeTimers()
      vi.mocked(storageModule.forceUploadToCloud).mockRejectedValue(new Error('Upload failed'))
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Advance timer
      await vi.advanceTimersByTimeAsync(2000)

      expect(wrapper.emitted('resolve')).toBeFalsy()
      vi.useRealTimers()
    })

    it('re-enables button after upload completes', async () => {
      vi.mocked(storageModule.forceUploadToCloud).mockResolvedValue(true)
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(forceUploadBtn.attributes('disabled')).toBeUndefined()
      expect(forceUploadBtn.text()).toBe('Force Upload Local to Cloud')
    })

    it('re-enables button after upload fails', async () => {
      vi.mocked(storageModule.forceUploadToCloud).mockRejectedValue(new Error('Upload failed'))
      const wrapper = mountComponent()

      const forceUploadBtn = wrapper.find('.force-upload-btn')
      await forceUploadBtn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(forceUploadBtn.attributes('disabled')).toBeUndefined()
      expect(forceUploadBtn.text()).toBe('Force Upload Local to Cloud')
    })
  })
})
