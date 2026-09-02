// src/features/custom-styles/store.ts
import { ref } from 'vue';
import { storage } from 'wxt/utils/storage';
import type { CustomStyle } from './types';
import { mergeById } from './backup';

const CUSTOM_STYLES_KEY = 'local:customStyles';
const EDITING_KEY = 'local:customStyles/editing';

/** storage item 私有:「存储即通道」是实现细节,消费方一律走 store interface(issue #18 Q4) */
const customStylesItem = storage.defineItem<CustomStyle[]>(CUSTOM_STYLES_KEY, { fallback: [] });
const editingItem = storage.defineItem<string | null>(EDITING_KEY, { fallback: null });

/**
 * custom-styles 单例 store(评审候选 3:repository + useCustomStyles 合一)。
 *
 * - 模块级单例:每页一份 watcher(此前侧边栏页 2 实例 × 2 watcher = 4 份)
 * - 写路径经全局队列串行(Q3),消跨上下文 read-modify-write 丢更新
 * - 本地写即时回填 ref(Q2);自己写入的回声按「载荷 = 最后本地写」跳过(时序无关)
 * - 不变式「编辑对象被删/被导入替换→清 editing」两处:remove 与 importStyles,均在队列 op 内直写(队列不可嵌套)
 */

// ---- 模块级状态(单例本体) ----

const styles = ref<CustomStyle[]>([]);
const editingId = ref<string | null>(null);

/** 写队列:所有 CRUD 串行过这一条 promise 链 */
let writeQueue: Promise<void> = Promise.resolve();

/** 最近一次本地写入的载荷:回声 watch 据此跳过自己的写(与回声到达时序无关) */
let lastLocalWrite = '';

// ---- 初始装载 + 外部变化同步 ----

void customStylesItem.getValue().then((v) => (styles.value = v ?? []));
void editingItem.getValue().then((v) => (editingId.value = v));

void customStylesItem.watch((v) => {
  const next = v ?? [];
  if (JSON.stringify(next) === lastLocalWrite) return; // 自己写的回声,ref 已即时回填
  styles.value = next;
  // 外部上下文删除了正在编辑的样式 → 回到清单视图
  if (editingId.value && !next.some((s) => s.id === editingId.value)) {
    void setEditing(null);
  }
});
void editingItem.watch((v) => {
  if (v === editingId.value) return;
  editingId.value = v ?? null;
});

// ---- 写路径(队列串行 + 即时回填) ----

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(op);
  // 队列永不断链:op 失败被吞,后续写照常
  writeQueue = run.then(() => {}, () => {});
  return run;
}

/** 队列 op 内的写辅助:记回声指纹 → 落 storage → 即时回填。仅限队列内调用 */
async function writeList(next: CustomStyle[]): Promise<void> {
  lastLocalWrite = JSON.stringify(next); // 先记指纹,setValue 的回声必然命中
  await customStylesItem.setValue(next);
  styles.value = next;
}

export function create(): Promise<CustomStyle> {
  return enqueue(async () => {
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
    await writeList([...(await customStylesItem.getValue()), style]);
    return style;
  });
}

export function update(
  id: string,
  patch: Partial<Pick<CustomStyle, 'name' | 'patterns' | 'code' | 'enabled'>>,
): Promise<void> {
  return enqueue(async () => {
    const next = (await customStylesItem.getValue()).map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
    );
    await writeList(next);
  });
}

export function remove(id: string): Promise<void> {
  return enqueue(async () => {
    const next = (await customStylesItem.getValue()).filter((s) => s.id !== id);
    await writeList(next);
    // 不变式:编辑对象被删 → 清 editing(Q1 唯一一处;已在队列内,直写不嵌套排队)
    if (editingId.value === id) {
      await editingItem.setValue(null);
      editingId.value = null;
    }
  });
}

/** v1 的优先级仅 = 列表顺序;delta -1 上移 / +1 下移,越界不动 */
export function move(id: string, delta: -1 | 1): Promise<void> {
  return enqueue(async () => {
    const list = await customStylesItem.getValue();
    const from = list.findIndex((s) => s.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    await writeList(next);
  });
}

export function setEditing(id: string | null): Promise<void> {
  return enqueue(async () => {
    await editingItem.setValue(id);
    editingId.value = id; // 即时回填
  });
}

export interface ImportSummary {
  overridden: number;
  added: number;
}

/**
 * 导入(issue #14):按 id 合并入 storage(mergeById 语义);经写队列串行。
 * 不变式推广:文件替换了正在编辑的样式 → 清 editing 回清单(同 remove;队列 op 内直写)。
 */
export function importStyles(incoming: CustomStyle[]): Promise<ImportSummary> {
  return enqueue(async () => {
    const local = await customStylesItem.getValue();
    const { merged, overridden, added } = mergeById(local, incoming);
    await writeList(merged);
    if (editingId.value !== null && incoming.some((s) => s.id === editingId.value)) {
      await editingItem.setValue(null);
      editingId.value = null;
    }
    return { overridden, added };
  });
}

// ---- 对外 interface ----

/**
 * 消费方获取 store(单例:多次调用同一份状态)。
 * styles 为只读语义(请勿直接改写;变更一律走 create/update/remove/move/importStyles)。
 */
export function useCustomStyles() {
  return { styles, editingId, create, update, remove, move, setEditing, importStyles };
}

/** storage 变化订阅(语义化别名):供 content script 等非 CRUD 消费方使用(issue #18 Q4) */
export function onStylesChanged(cb: () => void): () => void {
  return customStylesItem.watch(() => cb());
}

/** 读当前样式列表(语义化读取):与 onStylesChanged 配套,供 content script 等使用 */
export function readStyles(): Promise<CustomStyle[]> {
  return customStylesItem.getValue();
}
