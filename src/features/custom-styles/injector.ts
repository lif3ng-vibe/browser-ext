export interface StyleInjector {
  /** 保存样式(级联顺序由任务 1 在合成 CSS 时保证) */
  apply(css: string): void;
  /** 未保存预览:追加在主 sheet 之后,同特异性时覆盖已保存规则 */
  preview(css: string): void;
  clearPreview(): void;
}

/**
 * Constructable Stylesheet 注入器:免疫宿主页 CSP,
 * 主管 + 预览两张 sheet,adoptedStyleSheets 数组顺序即级联顺序。
 *
 * 不变量:两者同时在 adoptedStyleSheets 时,mainSheet 恒排在 previewSheet
 * 之前(同特异性时预览胜出)——不依赖 apply/preview 的调用先后。
 * 外部放入的 foreign sheet 只保留、不重排、不丢失。
 */
export function createInjector(target: Document = document): StyleInjector {
  const mainSheet = new CSSStyleSheet();
  const previewSheet = new CSSStyleSheet();

  /** adopt 并规范化顺序:foreign 不动,mainSheet 在 previewSheet 之前 */
  const adopt = (sheet: CSSStyleSheet) => {
    const current = target.adoptedStyleSheets;
    const sheets = current.includes(sheet) ? [...current] : [...current, sheet];
    const mainIdx = sheets.indexOf(mainSheet);
    const previewIdx = sheets.indexOf(previewSheet);
    if (mainIdx !== -1 && previewIdx !== -1 && mainIdx > previewIdx) {
      const main = sheets[mainIdx] as CSSStyleSheet;
      const preview = sheets[previewIdx] as CSSStyleSheet;
      sheets[mainIdx] = preview;
      sheets[previewIdx] = main;
    }
    target.adoptedStyleSheets = sheets;
  };

  return {
    apply(css) {
      // 空 CSS 且主 sheet 尚未 adopt:什么都不落,避免空 sheet 占位
      if (css === '' && !target.adoptedStyleSheets.includes(mainSheet)) return;
      mainSheet.replaceSync(css);
      adopt(mainSheet);
    },
    preview(css) {
      previewSheet.replaceSync(css);
      adopt(previewSheet);
    },
    clearPreview() {
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter((s) => s !== previewSheet);
      void previewSheet.replace('');
    },
  };
}