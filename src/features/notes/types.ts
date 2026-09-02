// src/features/notes/types.ts
/** 一条便签:纯文本随手记;url 为 null 即全局便签(取值特例,无双轨) */
export interface Note {
  id: string;
  /** 绑定的归一化页面 URL(去 hash);null 即全局便签 */
  url: string | null;
  text: string;
  createdAt: number;
  updatedAt: number;
}
