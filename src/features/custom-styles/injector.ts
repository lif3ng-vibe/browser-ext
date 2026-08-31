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
 */
export function createInjector(target: Document = document): StyleInjector {
  const mainSheet = new CSSStyleSheet();
  const previewSheet = new CSSStyleSheet();
  const adopt = (sheet: CSSStyleSheet) => {
    if (!target.adoptedStyleSheets.includes(sheet)) {
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    }
  };
  return {
    apply(css) {
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