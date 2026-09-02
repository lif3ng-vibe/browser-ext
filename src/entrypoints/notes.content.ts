// src/entrypoints/notes.content.ts
import { createNotesCardUi } from '@/features/notes/contentUi';
import '@/shared/theme/tailwind.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui', // 样式打进 shadow root(与宿主页面隔离,主题变量挂包裹层)
  main(ctx) {
    void createNotesCardUi(ctx);
  },
});