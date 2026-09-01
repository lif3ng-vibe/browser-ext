import { buildCss, collectStylesFor } from '@/features/custom-styles/matcher';
import { createInjector } from '@/features/custom-styles/injector';
import { onStylesChanged, readStyles } from '@/features/custom-styles/store';
import { onPreviewMessage } from '@/features/custom-styles/previewSession';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    const injector = createInjector();
    const refresh = async () => {
      const styles = await readStyles();
      injector.apply(buildCss(collectStylesFor(styles, location.href)));
    };
    void refresh();
    // storage 变化(任一端保存/启停/重排)→ 全体页面即时重生
    void onStylesChanged(() => void refresh());
    // 预览会话接收端:校验 + dispatch 在 module 内(type guard 拒绝 as 强转)
    browser.runtime.onMessage.addListener(onPreviewMessage((css) => {
      if (css === undefined) injector.clearPreview();
      else injector.preview(css);
    }));
  },
});
