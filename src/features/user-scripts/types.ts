// src/features/user-scripts/types.ts
/** 执行时机(词汇表「执行时机」):脚本级档位,默认 document_idle */
export type RunAt = 'document_start' | 'document_end' | 'document_idle';

const RUN_ATS: readonly RunAt[] = ['document_start', 'document_end', 'document_idle'];

/** 非法 runAt 归一为默认档 */
export function normalizeRunAt(v: unknown): RunAt {
  return RUN_ATS.includes(v as RunAt) ? (v as RunAt) : 'document_idle';
}

/** 执行时机的 UI 标签(列表行下拉与编辑器下拉共用) */
export const RUN_AT_LABEL: Record<RunAt, string> = {
  document_start: '文档开始',
  document_end: '文档结束',
  document_idle: '文档空闲(默认)',
};

/**
 * 一条用户脚本(词汇表「用户脚本」):命名、可启停、绑定一组标准 match pattern 作用域,
 * 由平台 userScripts API 注册注入。v1 裸注入器:无 GM_*、无元数据头。
 */
export interface UserScript {
  id: string;
  name: string;
  enabled: boolean;
  /** 标准 match pattern;'<all_urls>' 即全局。空列表/非法项不参与注入 */
  patterns: string[];
  code: string;
  runAt: RunAt;
  createdAt: number;
  updatedAt: number;
}
