// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InstallPrompt from '@/components/InstallPrompt.vue'

function fireInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const prompt = vi.fn(async () => {})
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) })
  window.dispatchEvent(event)
  return { event, prompt }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('InstallPrompt', () => {
  it('stays hidden until the browser offers an install prompt', async () => {
    const wrapper = mount(InstallPrompt)
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('offers install and disappears after acceptance', async () => {
    const wrapper = mount(InstallPrompt)

    const { event, prompt } = fireInstallPrompt('accepted')
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.get('[role="region"]').text()).toContain('Install Chinese Friend')

    const install = wrapper.findAll('button').find((button) => button.text() === 'Install')
    await install?.trigger('click')
    await flushPromises()

    expect(prompt).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the banner hidden after the user declines the browser prompt', async () => {
    const wrapper = mount(InstallPrompt)

    fireInstallPrompt('dismissed')
    await nextTick()

    const install = wrapper.findAll('button').find((button) => button.text() === 'Install')
    await install?.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('can be dismissed with Not now', async () => {
    const wrapper = mount(InstallPrompt)

    fireInstallPrompt('accepted')
    await nextTick()

    const notNow = wrapper.findAll('button').find((button) => button.text() === 'Not now')
    await notNow?.trigger('click')

    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
