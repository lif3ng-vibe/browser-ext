import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInjector } from '../injector';

/** replaceSync 记录的 css 字段(桩替身上的读取点) */
type RecordedSheet = CSSStyleSheet & { css: string };

/** CSSStyleSheet 桩:replaceSync 记录 css 供断言 */
function stubSheet(): CSSStyleSheet {
  const sheet = {
    replaceSync(css: string) {
      (sheet as unknown as { css: string }).css = css;
    },
    replace() {},
  };
  return sheet as unknown as CSSStyleSheet;
}

describe('injector(adoptedStyleSheets 控制器)', () => {
  beforeEach(() => {
    vi.stubGlobal('CSSStyleSheet', function cssStyleSheetStub() {
      return stubSheet();
    });
  });

  function fakeDoc() {
    return { adoptedStyleSheets: [] as CSSStyleSheet[] } as unknown as Document & {
      adoptedStyleSheets: CSSStyleSheet[];
    };
  }

  it('apply:主 sheet 注入 css 且只 adopt 一次', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.apply('b{}');
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    expect((doc.adoptedStyleSheets[0] as unknown as RecordedSheet).css).toBe('b{}');
  });

  it('preview 追加在主 sheet 之后(同特异性时预览胜出)', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.preview('p{}');
    expect(doc.adoptedStyleSheets).toHaveLength(2);
    expect((doc.adoptedStyleSheets[1] as unknown as RecordedSheet).css).toBe('p{}');
  });

  it('clearPreview 只移除预览 sheet', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.preview('p{}');
    inject.clearPreview();
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    inject.clearPreview(); // 幂等
    expect(doc.adoptedStyleSheets).toHaveLength(1);
  });
});