import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotebookMessage from '../NotebookMessage.vue'
import { Message } from '@/models/Message'

const SlotPassthrough = { template: '<div><slot /></div>' }

function makeMessage(overrides: Partial<{
  question: string
  response: string
  questionSummarized: string
  responseSummary: string
}> = {}) {
  return new Message({
    id: 'm1',
    question: overrides.question ?? 'What is photosynthesis?',
    response: overrides.response ?? 'Plants convert light into energy.',
    questionSummarized: overrides.questionSummarized ?? 'Photosynthesis question',
    responseSummary: overrides.responseSummary,
  })
}

function mountMessage(props: Record<string, unknown> = {}) {
  return mount(NotebookMessage, {
    props: { message: makeMessage(), ...props },
    global: {
      stubs: {
        MarkdownRenderer: true,
        ContextMenu: true,
        QuestionSearchModal: true,
        DictionaryModal: true,
        ResponseModal: true,
        SlideTransition: SlotPassthrough,
      },
    },
  })
}

describe('NotebookMessage collapse', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the Q&A header with the question summary', () => {
    const wrapper = mountMessage()
    expect(wrapper.find('.qa-header').exists()).toBe(true)
    expect(wrapper.find('.qa-question').text()).toBe('Photosynthesis question')
  })

  it('shows the answer by default', () => {
    const wrapper = mountMessage()
    expect(wrapper.find('.message-assistant').element.style.display).not.toBe('none')
  })

  it('collapses the answer when the header is clicked', async () => {
    const wrapper = mountMessage()
    await wrapper.find('.qa-header').trigger('click')
    expect(wrapper.find('.message-assistant').element.style.display).toBe('none')
  })

  it('expands the answer when toggled again', async () => {
    const wrapper = mountMessage()
    await wrapper.find('.qa-header').trigger('click')
    await wrapper.find('.qa-header').trigger('click')
    expect(wrapper.find('.message-assistant').element.style.display).not.toBe('none')
  })

  it('hides the response summary when collapsed', async () => {
    const wrapper = mountMessage({
      message: makeMessage({ responseSummary: 'A short summary.' }),
    })
    expect(wrapper.find('.response-summary-container').element.style.display).not.toBe('none')
    await wrapper.find('.qa-header').trigger('click')
    expect(wrapper.find('.response-summary-container').element.style.display).toBe('none')
  })

  it('toggles collapse via the chevron button', async () => {
    const wrapper = mountMessage()
    await wrapper.find('.qa-header button.collapse-toggle').trigger('click')
    expect(wrapper.find('.message-assistant').element.style.display).toBe('none')
  })

  it('hides the header and keeps the answer visible while streaming', () => {
    const wrapper = mountMessage({ isAppStreaming: true })
    expect(wrapper.find('.qa-header').exists()).toBe(false)
    expect(wrapper.find('.message-assistant').element.style.display).not.toBe('none')
  })
})
