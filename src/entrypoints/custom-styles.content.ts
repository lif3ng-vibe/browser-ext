import { buildCss, collectStylesFor } from '@/features/custom-styles/matcher';
import { createInjector } from '@/features/custom-styles/injector';
import { customStylesItem } from '@/features/custom-styles/repository';
import type { PreviewMessage } from '@/features/custom-styles/messages';
import { PREVIEW_MSG } from '@/features/custom-styles/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    const injector = createInjector();
    const refresh = async () => {
      const styles = await customStylesItem.getValue();
      injector.apply(buildCss(collectStylesFor(styles, location.href)));
    };
    void refresh();
    // storage 变化(任一端保存/启停/重排)→ 全体页面即时重生
    void customStylesItem.watch(() => void refresh());
    // 所见即所得:侧边栏未保存草稿的临时生效
    browser.runtime.onMessage.addListener((raw: unknown) => {
      const msg = raw as PreviewMessage | undefined;
      if (msg?.type === PREVIEW_MSG.PREVIEW) injector.preview(msg.css);
      else if (msg?.type === PREVIEW_MSG.CLEAR) injector.clearPreview();
    });
  },
});