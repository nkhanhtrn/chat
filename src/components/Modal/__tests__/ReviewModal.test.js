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
    recordReview: vi.fn(),
    removeCard: vi.fn()
  }))
}))

import { useSpacedRepetition } from '../../../composables/useSpacedRepetition.js'

describe('ReviewModal', () => {
  let mockRecordReview
  let mockRemoveCard

  beforeEach(() => {
    setActivePinia(createPinia())
    mockRecordReview = vi.fn()
    mockRemoveCard = vi.fn()
    vi.mocked(useSpacedRepetition).mockReturnValue({
      cardsDue: { value: [] },
      recordReview: mockRecordReview,
      removeCard: mockRemoveCard
    })
  })

  const mountModal = (props = {}, cardsDue = []) => {
    vi.mocked(useSpacedRepetition).mockReturnValue({
      cardsDue: { value: cardsDue },
      recordReview: mockRecordReview,
      removeCard: mockRemoveCard
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

  describe('card navigation', () => {
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
      },
      {
        messageId: 'msg-3',
        question: 'Question 3?',
        responseSummary: 'Answer 3',
        interval: 1,
        easiness: 2.5,
        repetitions: 0
      }
    ]

    it('shows navigation buttons in header', () => {
      const wrapper = mountModal({}, mockCards)
      const navButtons = wrapper.findAll('.nav-btn')
      expect(navButtons).toHaveLength(2)
    })

    it('disables previous button on first card', () => {
      const wrapper = mountModal({}, mockCards)
      const prevBtn = wrapper.findAll('.nav-btn')[0]
      expect(prevBtn.attributes('disabled')).toBeDefined()
    })

    it('enables next button on first card', () => {
      const wrapper = mountModal({}, mockCards)
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      expect(nextBtn.attributes('disabled')).toBeUndefined()
    })

    it('navigates to next card when next clicked', async () => {
      const wrapper = mountModal({}, mockCards)
      const nextBtn = wrapper.findAll('.nav-btn')[1]

      await nextBtn.trigger('click')

      expect(wrapper.find('.question-content').text()).toContain('Question 2?')
      expect(wrapper.find('.progress-indicator').text()).toBe('2 / 3')
    })

    it('navigates to previous card when previous clicked', async () => {
      const wrapper = mountModal({}, mockCards)
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      const prevBtn = wrapper.findAll('.nav-btn')[0]

      // Go to second card
      await nextBtn.trigger('click')
      expect(wrapper.find('.question-content').text()).toContain('Question 2?')

      // Go back to first card
      await prevBtn.trigger('click')
      expect(wrapper.find('.question-content').text()).toContain('Question 1?')
      expect(wrapper.find('.progress-indicator').text()).toBe('1 / 3')
    })

    it('disables next button on last card', async () => {
      const wrapper = mountModal({}, mockCards)
      const nextBtn = wrapper.findAll('.nav-btn')[1]

      // Navigate to last card
      await nextBtn.trigger('click')
      await nextBtn.trigger('click')

      expect(nextBtn.attributes('disabled')).toBeDefined()
    })

    it('enables previous button after navigating forward', async () => {
      const wrapper = mountModal({}, mockCards)
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      const prevBtn = wrapper.findAll('.nav-btn')[0]

      await nextBtn.trigger('click')

      expect(prevBtn.attributes('disabled')).toBeUndefined()
    })

    it('resets flip state when navigating', async () => {
      const wrapper = mountModal({}, mockCards)

      // Flip the card
      await wrapper.find('.show-answer-btn').trigger('click')
      expect(wrapper.find('.card-back').exists()).toBe(true)

      // Navigate to next card
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')

      // Should show front of next card
      expect(wrapper.find('.card-front').exists()).toBe(true)
    })
  })

  describe('delete card', () => {
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

    it('shows delete button in header when card is displayed', () => {
      const wrapper = mountModal({}, mockCards)
      expect(wrapper.find('.delete-btn').exists()).toBe(true)
    })

    it('does not show delete button when no cards', () => {
      const wrapper = mountModal({}, [])
      expect(wrapper.find('.delete-btn').exists()).toBe(false)
    })

    it('calls removeCard when delete button clicked', async () => {
      const wrapper = mountModal({}, mockCards)

      await wrapper.find('.delete-btn').trigger('click')

      expect(mockRemoveCard).toHaveBeenCalledWith('msg-1')
    })

    it('resets flip state after deleting card', async () => {
      const wrapper = mountModal({}, mockCards)

      // Flip the card
      await wrapper.find('.show-answer-btn').trigger('click')
      expect(wrapper.find('.card-back').exists()).toBe(true)

      // Delete the card
      await wrapper.find('.delete-btn').trigger('click')

      // Should show front of card (flip reset)
      expect(wrapper.find('.card-front').exists()).toBe(true)
    })
  })
})
