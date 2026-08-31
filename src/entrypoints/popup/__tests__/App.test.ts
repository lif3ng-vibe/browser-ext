import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../App.vue';

describe('popup App', () => {
  it('渲染骨架标题', () => {
    const wrapper = mount(App);
    expect(wrapper.find('h1').text()).toBe('browser-ext');
  });
});
