import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import DictionaryModal from '../modal/DictionaryModal.vue'

let wrapper: VueWrapper<any>

const mockLookup = vi.fn()

vi.mock('@/services/offlineDictionary', () => ({
  dictionaryLookup: (...args: any[]) => mockLookup(...args),
  _test: {
    editDistance: () => 0,
    fuzzyMatch: () => null,
    toResult: () => ({}),
  },
}))

const ModalStub = {
  name: 'Modal',
  template: '<div class="modal-stub"><slot name="header" /><slot name="header-actions" /><slot /><slot name="footer" /></div>',
  props: ['visible', 'size', 'titleStyle'],
  emits: ['close'],
}

function mountModal(props = {}) {
  if (wrapper) wrapper.unmount()
  wrapper = mount(DictionaryModal, {
    props: {
      visible: true,
      word: 'test',
      ...props,
    },
    global: {
      stubs: { Modal: ModalStub },
    },
  })
  return wrapper
}

describe('DictionaryModal', () => {
  beforeEach(() => {
    mockLookup.mockReset()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    vi.restoreAllMocks()
  })

  describe('with pre-loaded definition', () => {
    it('renders entries from definition with POS and examples', () => {
      mountModal({
        word: 'think',
        definition: '**v.** to reason about something\n> "I think therefore I am"\n\n**n.** an act of thinking',
      })

      const entries = wrapper.findAll('.dict-entry')
      expect(entries).toHaveLength(2)
      expect(entries[0].find('.dict-pos').text()).toBe('v.')
      expect(entries[0].find('.dict-def').text()).toContain('to reason about something')
      expect(entries[0].findAll('.dict-example')).toHaveLength(1)
      expect(entries[1].find('.dict-pos').text()).toBe('n.')
    })

    it('shows pronunciation when provided', () => {
      mountModal({
        word: 'think',
        pronunciation: '/θɪŋk/',
        definition: '**v.** to reason',
      })

      expect(wrapper.find('.dict-title-pron').text()).toBe('/θɪŋk/')
    })

    it('shows context when provided', () => {
      mountModal({
        word: 'think',
        context: 'I think therefore I am',
        definition: '**v.** to reason',
      })

      expect(wrapper.find('.dict-context').text()).toContain('I think therefore I am')
    })

    it('shows "No definition found" when definition is empty', async () => {
      mountModal({
        word: 'unknown',
        definition: '',
      })
      await nextTick()
      await nextTick()

      expect(wrapper.find('.dict-empty').text()).toBe('No definition found.')
    })
  })

  describe('offline lookup', () => {
    it('calls dictionaryLookup when opened with word but no definition', async () => {
      mockLookup.mockResolvedValue({
        definition: '**v.** to reason\n> "Think before you act"',
        pronunciation: '/θɪŋk/',
        fuzzy: false,
      })

      mountModal({ word: 'think', definition: '' })
      await nextTick()
      await nextTick()

      expect(mockLookup).toHaveBeenCalledWith('think')
      expect(wrapper.findAll('.dict-entry')).toHaveLength(1)
      expect(wrapper.find('.dict-title-pron').text()).toBe('/θɪŋk/')
    })

    it('emits lookup event with result', async () => {
      const result = {
        definition: '**v.** to reason',
        pronunciation: '/θɪŋk/',
        fuzzy: false,
      }
      mockLookup.mockResolvedValue(result)

      mountModal({ word: 'think' })
      await nextTick()
      await nextTick()

      expect(wrapper.emitted('lookup')).toBeDefined()
      expect(wrapper.emitted('lookup')![0][0]).toEqual({
        definition: result.definition,
        pronunciation: result.pronunciation,
      })
    })

    it('shows "No definition found" when lookup returns null', async () => {
      mockLookup.mockResolvedValue(null)

      mountModal({ word: 'xyz' })
      await nextTick()
      await nextTick()

      expect(wrapper.find('.dict-empty').text()).toBe('No definition found.')
    })

    it('shows loading cursor while looking up', async () => {
      let resolveLookup: (v: any) => void
      mockLookup.mockReturnValue(new Promise(r => { resolveLookup = r }))

      mountModal({ word: 'think' })
      await nextTick()

      expect(wrapper.find('.dict-cursor').exists()).toBe(true)

      resolveLookup!({ definition: '**v.** to reason', pronunciation: '', fuzzy: false })
      await nextTick()
      await nextTick()

      expect(wrapper.find('.dict-cursor').exists()).toBe(false)
    })
  })

  describe('speak button', () => {
    it('calls speechSynthesis when clicked', async () => {
      const mockSpeak = vi.fn()
      vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: mockSpeak })
      vi.stubGlobal('SpeechSynthesisUtterance', vi.fn().mockImplementation(function (this: any, text: string) { this.text = text; this.lang = '' }))

      mountModal({
        word: 'think',
        definition: '**v.** to reason',
      })

      await wrapper.find('.dict-speak-btn').trigger('click')

      expect(mockSpeak).toHaveBeenCalled()

      vi.unstubAllGlobals()
    })
  })
})
