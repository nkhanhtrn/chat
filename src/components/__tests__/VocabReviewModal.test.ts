import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import VocabReviewModal from '../modal/VocabReviewModal.vue'
import { useVocabStore } from '@/stores/vocab'

let wrapper: VueWrapper<any>

vi.mock('@/services/offlineDictionary', () => ({
  dictionaryLookup: vi.fn().mockResolvedValue(null),
  _test: { editDistance: () => 0, fuzzyMatch: () => null, toResult: () => ({}) },
}))

const ModalStub = {
  name: 'Modal',
  template: '<div class="modal-stub"><slot name="header" /><slot /><slot name="footer" /></div>',
  props: ['visible', 'size', 'title'],
  emits: ['close'],
}

const DictionaryModalStub = {
  name: 'DictionaryModal',
  template: '<div class="dict-modal-stub"><slot name="footer" /></div>',
  props: ['visible', 'word', 'definition', 'context', 'pronunciation'],
  emits: ['close', 'lookup'],
}

function mountReviewModal(props = {}) {
  if (wrapper) wrapper.unmount()
  wrapper = mount(VocabReviewModal, {
    props: {
      visible: true,
      ...props,
    },
    global: {
      stubs: {
        Modal: ModalStub,
        DictionaryModal: DictionaryModalStub,
      },
      plugins: [],
    },
  })
  return wrapper
}

describe('VocabReviewModal', () => {
  let vocabStore: ReturnType<typeof useVocabStore>

  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('card-1')
      .mockReturnValueOnce('card-2')
      .mockReturnValueOnce('card-3')
    setActivePinia(createPinia())
    vocabStore = useVocabStore()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    vi.restoreAllMocks()
  })

  function seedCards() {
    const id1 = vocabStore.addVocabCard({ word: 'ephemeral', definition: '**adj.** short-lived', context: 'ephemeral beauty' })
    vocabStore.vocabData[id1].createdAt = 3000
    const id2 = vocabStore.addVocabCard({ word: 'ubiquitous', definition: '**adj.** present everywhere', context: 'ubiquitous computing' })
    vocabStore.vocabData[id2].createdAt = 2000
    const id3 = vocabStore.addVocabCard({ word: 'pragmatic', definition: '**adj.** practical', context: 'pragmatic approach' })
    vocabStore.vocabData[id3].createdAt = 1000
  }

  describe('empty state', () => {
    it('shows empty message when no cards', () => {
      mountReviewModal()

      expect(wrapper.find('.vocab-empty').text()).toContain('No vocabulary cards yet')
    })
  })

  describe('with cards', () => {
    it('passes first card to DictionaryModal', () => {
      seedCards()
      mountReviewModal()

      const dictModal = wrapper.findComponent({ name: 'DictionaryModal' })
      expect(dictModal.props('word')).toBe('ephemeral')
      expect(dictModal.props('definition')).toBe('**adj.** short-lived')
      expect(dictModal.props('context')).toBe('ephemeral beauty')
    })

    it('shows card counter', () => {
      seedCards()
      mountReviewModal()

      expect(wrapper.find('.vocab-card-counter').text()).toBe('1 / 3')
    })

    it('navigates to next card', async () => {
      seedCards()
      mountReviewModal()

      const nextBtn = wrapper.findAll('.vocab-nav-btn')[1]
      await nextBtn.trigger('click')
      await nextTick()

      const dictModal = wrapper.findComponent({ name: 'DictionaryModal' })
      expect(dictModal.props('word')).toBe('ubiquitous')
      expect(wrapper.find('.vocab-card-counter').text()).toBe('2 / 3')
    })

    it('navigates to previous card', async () => {
      seedCards()
      mountReviewModal()

      const nextBtn = wrapper.findAll('.vocab-nav-btn')[1]
      await nextBtn.trigger('click')
      await nextTick()

      const prevBtn = wrapper.findAll('.vocab-nav-btn')[0]
      await prevBtn.trigger('click')
      await nextTick()

      const dictModal = wrapper.findComponent({ name: 'DictionaryModal' })
      expect(dictModal.props('word')).toBe('ephemeral')
    })

    it('disables prev button on first card', () => {
      seedCards()
      mountReviewModal()

      const prevBtn = wrapper.findAll('.vocab-nav-btn')[0]
      expect(prevBtn.attributes('disabled')).toBeDefined()
    })

    it('disables next button on last card', async () => {
      seedCards()
      mountReviewModal()

      const nextBtn = wrapper.findAll('.vocab-nav-btn')[1]
      await nextBtn.trigger('click')
      await nextBtn.trigger('click')
      await nextTick()

      expect(nextBtn.attributes('disabled')).toBeDefined()
    })

    it('removes card and adjusts index', async () => {
      seedCards()
      mountReviewModal()

      const deleteBtn = wrapper.find('.vocab-card-delete')
      await deleteBtn.trigger('click')
      await nextTick()

      expect(Object.keys(vocabStore.vocabData)).toHaveLength(2)
      expect(wrapper.find('.vocab-card-counter').text()).toBe('1 / 2')
    })

    it('emits close when DictionaryModal emits close', async () => {
      seedCards()
      mountReviewModal()

      const dictModal = wrapper.findComponent({ name: 'DictionaryModal' })
      dictModal.vm.$emit('close')
      await nextTick()

      expect(wrapper.emitted('close')).toBeDefined()
    })
  })
})
