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

  it('预览先到仍然最后胜出:mainSheet 恒在 previewSheet 之前', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.preview('p{}');
    inject.apply('a{}');
    expect(doc.adoptedStyleSheets).toHaveLength(2);
    expect((doc.adoptedStyleSheets[0] as unknown as RecordedSheet).css).toBe('a{}');
    expect((doc.adoptedStyleSheets[1] as unknown as RecordedSheet).css).toBe('p{}');
  });

  it('规范化不丢失、不重排外部(foreign)sheet', () => {
    const doc = fakeDoc();
    const foreign = stubSheet();
    doc.adoptedStyleSheets.push(foreign);
    const inject = createInjector(doc);
    inject.preview('p{}');
    inject.apply('a{}');
    expect(doc.adoptedStyleSheets).toHaveLength(3);
    expect(doc.adoptedStyleSheets[0]).toBe(foreign);
    expect((doc.adoptedStyleSheets[1] as unknown as RecordedSheet).css).toBe('a{}');
    expect((doc.adoptedStyleSheets[2] as unknown as RecordedSheet).css).toBe('p{}');
  });

  it('apply 空串:未 adopt 过则不落 sheet;再 apply 非空只出现 main', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('');
    expect(doc.adoptedStyleSheets).toHaveLength(0);
    inject.apply('a{}');
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    expect((doc.adoptedStyleSheets[0] as unknown as RecordedSheet).css).toBe('a{}');
  });

  it('apply 空串:main 已在 adopted 中则清空其内容(仍在场)', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.apply('');
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    expect((doc.adoptedStyleSheets[0] as unknown as RecordedSheet).css).toBe('');
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