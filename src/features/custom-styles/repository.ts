// src/features/custom-styles/repository.ts
import { storage } from 'wxt/utils/storage';
import type { CustomStyle } from './types';

const CUSTOM_STYLES_KEY = 'local:customStyles';
const EDITING_KEY = 'local:customStyles/editing';

export const customStylesItem = storage.defineItem<CustomStyle[]>(CUSTOM_STYLES_KEY, { fallback: [] });
/** 正在编辑的样式 id:UI 全局状态,options 的「编辑」按钮经由此把侧边栏带到目标样式(存储即通道) */
export const editingItem = storage.defineItem<string | null>(EDITING_KEY, { fallback: null });
/** 编辑器自动折行开关(默认开):StyleEditor 的「折行」复选框读写,CodeEditor 消费 */
export const editorWrapItem = storage.defineItem<boolean>('local:customStyles/editorWrap', {
  fallback: true,
});

export async function listStyles(): Promise<CustomStyle[]> {
  return customStylesItem.getValue();
}

export async function createStyle(): Promise<CustomStyle> {
  const now = Date.now();
  const style: CustomStyle = {
    id: crypto.randomUUID(),
    name: '未命名样式',
    enabled: false,
    patterns: ['<all_urls>'],
    code: '',
    createdAt: now,
    updatedAt: now,
  };
  await customStylesItem.setValue([...(await listStyles()), style]);
  return style;
}

export async function updateStyle(
  id: string,
  patch: Partial<Pick<CustomStyle, 'name' | 'patterns' | 'code' | 'enabled'>>,
): Promise<void> {
  const styles = await listStyles();
  await customStylesItem.setValue(
    styles.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
  );
}

export async function removeStyle(id: string): Promise<void> {
  const styles = await listStyles();
  await customStylesItem.setValue(styles.filter((s) => s.id !== id));
  if ((await editingItem.getValue()) === id) await editingItem.setValue(null);
}

/** v1 的优先级仅 = 列表顺序;delta -1 上移 / +1 下移,越界不动 */
export async function moveStyle(id: string, delta: -1 | 1): Promise<void> {
  const styles = await listStyles();
  const from = styles.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= styles.length) return;
  const next = [...styles];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  await customStylesItem.setValue(next);
}