// src/features/notes/contentUi.ts
import { createApp, h } from 'vue';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import NoteCard from './components/NoteCard.vue';
import { useCurrentUrl } from './useCurrentUrl';
import { applyThemeToElementTracked } from '@/shared/theme/applyToElement';

/**
 * 悬浮卡片的 Shadow DOM 挂载(content UI 平台路径,规格 #21,不测):
 * createShadowRootUi + cssInjectionMode:'ui',仅顶层 frame(all_frames 默认 false)。
 *
 * 主题变量挂 shadow tree 内的 uiContainer(WXT 把入口 CSS 的 :root 重写为 :host,
 * 只有默认主题块命中 host;各主题的 [data-theme] 块必须落在 shadow tree 内才匹配,
 * uiContainer 兼顾两者——调研 §4.2 的第二落点)。变量经 all:initial 边界照常继承
 * (all 不重置 custom properties);解析与跟随全部内建在 shared/theme,本文件不经手键。
 */
export async function createNotesCardUi(ctx: ContentScriptContext): Promise<void> {
  const currentUrl = useCurrentUrl();

  const ui = await createShadowRootUi(ctx, {
    name: 'lif3ng-notes',
    position: 'overlay',
    zIndex: 2147483000,
    isolateEvents: true, // 键盘事件不冒泡进宿主页面的快捷键
    onMount(uiContainer) {
      const stopTheme = applyThemeToElementTracked(uiContainer);
      // currentUrl 经 render 函数逐帧取值:SPA 换页时 NoteCard 的 props 跟随新 URL
      const app = createApp({ setup: () => () => h(NoteCard, { currentUrl: currentUrl.value }) });
      app.mount(uiContainer);
      return { app, stopTheme };
    },
    onRemove(mounted) {
      mounted?.app.unmount();
      mounted?.stopTheme();
    },
  });
  ui.mount();
}