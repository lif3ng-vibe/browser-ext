// src/features/custom-styles/types.ts
/** 一条自定义样式:命名、可启停、绑定一组标准 match pattern 作用域(级联顺序 = 列表顺序) */
export interface CustomStyle {
  id: string;
  name: string;
  enabled: boolean;
  /** 标准 match pattern;'<all_urls>' 即全局。空列表/非法项不参与自动注入 */
  patterns: string[];
  code: string;
  createdAt: number;
  updatedAt: number;
}