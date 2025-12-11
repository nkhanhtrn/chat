import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ReviewModal from '../ReviewModal.vue'
import Modal from '../Modal.vue'
import MarkdownRenderer from '../../MarkdownRenderer.vue'
import { useChatStore } from '../../../stores/chat.js'
import SRCard from '../../../stores/SRCard.js'
import Message from '../../../stores/Message.js'

// Mock the composable
vi.mock('../../../composables/useSpacedRepetition.js', () => ({
  useSpacedRepetition: vi.fn(() => ({
    cardsDue: { value: [] },
    recordReview: vi.fn()
  }))
}))

import { useSpacedRepetition } from '../../../composables/useSpacedRepetition.js'

describe('ReviewModal', () => {
  let mockRecordReview

  beforeEach(() => {
    setActivePinia(createPinia())
    mockRecordReview = vi.fn()
    vi.mocked(useSpacedRepetition).mockReturnValue({
      cardsDue: { value: [] },
      recordReview: mockRecordReview
    })
  })

  const mountModal = (props = {}, cardsDue = []) => {
    vi.mocked(useSpacedRepetition).mockReturnValue({
      cardsDue: { value: cardsDue },
      recordReview: mockRecordReview
    })

    return mount(ReviewModal, {
      props: {
        visible: true,
        ...props
      },
      global: {
        components: {
          Modal,
          MarkdownRenderer
        },
        stubs: {
          Modal: {
            template: `
              <div v-if="visible" class="modal-stub">
                <slot name="header-actions"></slot>
                <slot></slot>
              </div>
            `,
            props: ['visible', 'title', 'size', 'preventClose']
          },
          MarkdownRenderer: {
            template: '<div class="markdown-stub">{{ content }}</div>',
            props: ['content']
          }
        }
      }
    })
  }

  describe('when no cards are due', () => {
    it('shows no cards message', () => {
      const wrapper = mountModal()
      expect(wrapper.find('.no-cards').exists()).toBe(true)
      expect(wrapper.text()).toContain('No cards due for review')
    })

    it('shows empty icon', () => {
      const wrapper = mountModal()
      expect(wrapper.find('.empty-icon').text()).toBe('📚')
    })
  })

  describe('when cards are due', () => {
    const mockCards = [
      {
        messageId: 'msg-1',
        question: 'What is Vue?',
        responseSummary: '- A JavaScript framework\n- For building UIs',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      },
      {
        messageId: 'msg-2',
        question: 'What is Pinia?',
        responseSummary: '- State management\n- For Vue apps',
        interval: 6,
        easiness: 2.5,
        repetitions: 1
      }
    ]

    it('shows progress indicator', () => {
      const wrapper = mountModal({}, mockCards)
      expect(wrapper.find('.progress-indicator').text()).toBe('1 / 2')
    })

    it('shows question on front of card', () => {
      const wrapper = mountModal({}, mockCards)
      expect(wrapper.find('.question-content').text()).toContain('What is Vue?')
    })

    it('shows question in quotes', () => {
      const wrapper = mountModal({}, mockCards)
      const questionText = wrapper.find('.question-content').text()
      expect(questionText).toContain('"')
    })

    it('shows "Show Answer" button on front', () => {
      const wrapper = mountModal({}, mockCards)
      expect(wrapper.find('.show-answer-btn').exists()).toBe(true)
      expect(wrapper.find('.show-answer-btn').text()).toBe('Show Answer')
    })

    it('does not show rating buttons on front', () => {
      const wrapper = mountModal({}, mockCards)
      expect(wrapper.find('.rating-buttons').exists()).toBe(false)
    })
  })

  describe('flipping card', () => {
    const mockCards = [
      {
        messageId: 'msg-1',
        question: 'What is Vue?',
        responseSummary: '- A JavaScript framework',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      }
    ]

    it('shows answer after clicking Show Answer', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')

      expect(wrapper.find('.card-back').exists()).toBe(true)
      expect(wrapper.find('.answer-content').exists()).toBe(true)
    })

    it('hides Show Answer button after flip', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')

      expect(wrapper.find('.show-answer-btn').exists()).toBe(false)
    })

    it('shows rating buttons after flip', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')

      expect(wrapper.find('.rating-buttons').exists()).toBe(true)
      expect(wrapper.findAll('.rating-btn')).toHaveLength(4)
    })

    it('shows all rating options', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')

      const buttons = wrapper.findAll('.rating-btn')
      expect(buttons[0].text()).toContain('Again')
      expect(buttons[1].text()).toContain('Hard')
      expect(buttons[2].text()).toContain('Good')
      expect(buttons[3].text()).toContain('Easy')
    })

    it('shows "No summary available" when summary is empty', async () => {
      const cardsWithNoSummary = [{
        messageId: 'msg-1',
        question: 'Test?',
        responseSummary: '',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      }]

      const wrapper = mountModal({}, cardsWithNoSummary)
      await wrapper.find('.show-answer-btn').trigger('click')

      expect(wrapper.text()).toContain('No summary available')
    })
  })

  describe('rating cards', () => {
    const mockCards = [
      {
        messageId: 'msg-1',
        question: 'Question 1?',
        responseSummary: 'Answer 1',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      },
      {
        messageId: 'msg-2',
        question: 'Question 2?',
        responseSummary: 'Answer 2',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      }
    ]

    it('calls recordReview with quality 0 for Again', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-again').trigger('click')

      expect(mockRecordReview).toHaveBeenCalledWith('msg-1', 0)
    })

    it('calls recordReview with quality 2 for Hard', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-hard').trigger('click')

      expect(mockRecordReview).toHaveBeenCalledWith('msg-1', 2)
    })

    it('calls recordReview with quality 4 for Good', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      expect(mockRecordReview).toHaveBeenCalledWith('msg-1', 4)
    })

    it('calls recordReview with quality 5 for Easy', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-easy').trigger('click')

      expect(mockRecordReview).toHaveBeenCalledWith('msg-1', 5)
    })

    it('advances to next card after rating', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      // Should show next question (card is flipped back)
      expect(wrapper.find('.question-content').text()).toContain('Question 2?')
    })

    it('updates progress indicator after rating', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      expect(wrapper.find('.progress-indicator').text()).toBe('2 / 2')
    })
  })

  describe('session completion', () => {
    const singleCard = [{
      messageId: 'msg-1',
      question: 'Only question?',
      responseSummary: 'Only answer',
      interval: 1,
      easiness: 2.5,
      repetitions: 0
    }]

    it('shows completion message after all cards reviewed', async () => {
      const wrapper = mountModal({}, singleCard)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      expect(wrapper.find('.session-complete').exists()).toBe(true)
      expect(wrapper.text()).toContain('Session Complete!')
    })

    it('shows completion icon', async () => {
      const wrapper = mountModal({}, singleCard)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      expect(wrapper.find('.complete-icon').text()).toBe('🎉')
    })

    it('shows total cards reviewed', async () => {
      const wrapper = mountModal({}, singleCard)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      expect(wrapper.text()).toContain("You've reviewed all 1 cards")
    })

    it('shows Done button', async () => {
      const wrapper = mountModal({}, singleCard)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')

      expect(wrapper.find('.done-btn').exists()).toBe(true)
    })

    it('emits close when Done clicked', async () => {
      const wrapper = mountModal({}, singleCard)

      await wrapper.find('.show-answer-btn').trigger('click')
      await wrapper.find('.rating-good').trigger('click')
      await wrapper.find('.done-btn').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('interval text hints', () => {
    it('shows "1 day" for first review', async () => {
      const cards = [{
        messageId: 'msg-1',
        question: 'Q?',
        responseSummary: 'A',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      }]

      const wrapper = mountModal({}, cards)
      await wrapper.find('.show-answer-btn').trigger('click')

      const goodHint = wrapper.find('.rating-good .rating-hint')
      expect(goodHint.text()).toBe('1 day')
    })

    it('shows "6 days" for second review', async () => {
      const cards = [{
        messageId: 'msg-1',
        question: 'Q?',
        responseSummary: 'A',
        interval: 1,
        easiness: 2.5,
        repetitions: 1
      }]

      const wrapper = mountModal({}, cards)
      await wrapper.find('.show-answer-btn').trigger('click')

      const goodHint = wrapper.find('.rating-good .rating-hint')
      expect(goodHint.text()).toBe('6 days')
    })

    it('shows months for longer intervals', async () => {
      const cards = [{
        messageId: 'msg-1',
        question: 'Q?',
        responseSummary: 'A',
        interval: 30,
        easiness: 2.5,
        repetitions: 2
      }]

      const wrapper = mountModal({}, cards)
      await wrapper.find('.show-answer-btn').trigger('click')

      const goodHint = wrapper.find('.rating-good .rating-hint')
      expect(goodHint.text()).toContain('months')
    })
  })

  describe('modal visibility', () => {
    it('resets state when modal opens', async () => {
      const cards = [{
        messageId: 'msg-1',
        question: 'Q?',
        responseSummary: 'A',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      }]

      const wrapper = mountModal({ visible: false }, cards)

      // Open modal
      await wrapper.setProps({ visible: true })

      // Should show front of first card
      expect(wrapper.find('.card-front').exists()).toBe(true)
    })
  })
})
