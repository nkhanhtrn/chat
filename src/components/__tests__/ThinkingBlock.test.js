import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ThinkingBlock from '../ThinkingBlock.vue'

describe('ThinkingBlock', () => {
  it('renders thinking content', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test thinking content',
        showThinking: true
      }
    })

    expect(wrapper.find('.thinking-content').text()).toBe('Test thinking content')
  })

  it('shows thinking label by default', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test',
        showThinking: false
      }
    })

    expect(wrapper.find('.thinking-label').text()).toContain('Thinking')
  })

  it('shows compressed label when compressed is true', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Compressed content',
        showThinking: false,
        compressed: true,
        compressedCount: 5
      }
    })

    expect(wrapper.find('.thinking-label').text()).toContain('Compressed previous conversation')
    expect(wrapper.find('.thinking-label').text()).toContain('5 messages')
  })

  it('toggles thinking content when header is clicked', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test content',
        showThinking: false
      }
    })

    expect(wrapper.find('.thinking-content').exists()).toBe(false)

    await wrapper.find('.thinking-header').trigger('click')
    await nextTick()

    expect(wrapper.find('.thinking-content').exists()).toBe(true)
    expect(wrapper.find('.thinking-content').text()).toBe('Test content')
  })

  it('starts expanded when showThinking is true', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test content',
        showThinking: true
      }
    })

    expect(wrapper.find('.thinking-content').exists()).toBe(true)
    expect(wrapper.find('.thinking-icon').text()).toBe('▼')
  })

  it('starts collapsed when showThinking is false', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test content',
        showThinking: false
      }
    })

    expect(wrapper.find('.thinking-content').exists()).toBe(false)
    expect(wrapper.find('.thinking-icon').text()).toBe('▶')
  })

  it('updates expansion state when showThinking prop changes', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test content',
        showThinking: false
      }
    })

    expect(wrapper.find('.thinking-content').exists()).toBe(false)

    await wrapper.setProps({ showThinking: true })
    await nextTick()

    expect(wrapper.find('.thinking-content').exists()).toBe(true)
  })

  it('can collapse after being auto-expanded by prop change', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test content',
        showThinking: false
      }
    })

    // Auto-expand via prop
    await wrapper.setProps({ showThinking: true })
    await nextTick()
    expect(wrapper.find('.thinking-content').exists()).toBe(true)

    // User clicks to collapse
    await wrapper.find('.thinking-header').trigger('click')
    await nextTick()
    expect(wrapper.find('.thinking-content').exists()).toBe(false)
  })

  it('shows thinking dots animation', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test',
        showThinking: false,
        compressed: false
      }
    })

    const thinkingDots = wrapper.find('.thinking-dots')
    expect(thinkingDots.exists()).toBe(true)
    expect(thinkingDots.findAll('span')).toHaveLength(3)
  })

  it('does not show thinking dots for compressed content', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Test',
        showThinking: false,
        compressed: true
      }
    })

    expect(wrapper.find('.thinking-dots').exists()).toBe(false)
  })

  it('renders thinking content as array with progressive display', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: ['First step', 'Second step', 'Third step'],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    // Should only show first step (not completed, so future steps hidden)
    expect(items).toHaveLength(1)
    expect(items[0].text()).toBe('First step')
  })

  it('renders single string as plain text', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: 'Single step',
        showThinking: true
      }
    })

    expect(wrapper.find('.thinking-list').exists()).toBe(false)
    expect(wrapper.find('.thinking-content').text()).toBe('Single step')
  })

  it('handles array with URL fetch progress', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: [
          '⟳ Fetching content from https://example.com...',
          'Analyzing your question and generating a response...'
        ],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    // Should only show first item (in progress, so future items hidden)
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('Fetching content from')
  })

  it('handles array with completed URL fetch', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: [
          '✓ Fetched content from https://example.com',
          'Analyzing your question and generating a response...'
        ],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('✓ Fetched content')
    expect(items[1].text()).toContain('Analyzing your question')
  })

  it('shows only completed tasks and current active task', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: [
          '✓ Completed task 1',
          '⟳ In progress task 2',
          'Future task 3'
        ],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    // Should only show first two items (completed + current)
    expect(items).toHaveLength(2)
    expect(items[0].text()).toBe('✓ Completed task 1')
    expect(items[1].text()).toBe('⟳ In progress task 2')
  })

  it('shows all tasks when all are completed', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: [
          '✓ Task 1 done',
          '✓ Task 2 done',
          '✓ Task 3 done'
        ],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    expect(items).toHaveLength(3)
  })

  it('shows only first task if none are completed', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: [
          '⟳ Current task',
          'Future task 1',
          'Future task 2'
        ],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toBe('⟳ Current task')
  })

  it('handles failed tasks with X mark', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        content: [
          '✗ Failed to fetch URL',
          'Analyzing without URL context...'
        ],
        showThinking: true
      }
    })

    const items = wrapper.findAll('.thinking-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toBe('✗ Failed to fetch URL')
    expect(items[1].text()).toBe('Analyzing without URL context...')
  })
})
