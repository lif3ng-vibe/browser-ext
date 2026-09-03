// src/features/user-scripts/store.ts
import { ref } from 'vue';
import { storage } from 'wxt/utils/storage';
import type { UserScript } from './types';
import { normalizeRunAt } from './types';

const USER_SCRIPTS_KEY = 'local:userScripts';
const EDITING_KEY = 'local:userScripts/editing';

/** storage item 私有:「存储即通道」是实现细节,消费方一律走 store interface(平移 custom-styles #18 定稿) */
const userScriptsItem = storage.defineItem<UserScript[]>(USER_SCRIPTS_KEY, { fallback: [] });
const editingItem = storage.defineItem<string | null>(EDITING_KEY, { fallback: null });

/**
 * user-scripts 单例 store(镜像 custom-styles / notes 定稿模式,#13 规格「数据形状」):
 *
 * - 模块级单例:每页一份状态,消费方 useUserScripts() 拿同一份
 * - 写路径经全局队列串行,消跨上下文 read-modify-write 丢更新
 * - 本地写即时回填 ref;自己写入的回声按「载荷 = 最后本地写」跳过(时序无关)
 * - 读路径归一化防御(custom-styles a0e2b6f 先例):坏 patterns 归 []、坏 runAt 归默认档、
 *   非对象条目丢弃 —— 词汇表既有语义:空列表不参与注入,脚本保留可编辑
 * - 不变式「编辑对象被删 → 清 editing」唯一一处在 remove,队列 op 内直写
 */

// ---- 模块级状态(单例本体) ----

const scripts = ref<UserScript[]>([]);
const editingId = ref<string | null>(null);

/** 写队列:所有 CRUD 串行过这一条 promise 链 */
let writeQueue: Promise<void> = Promise.resolve();

/** 最近一次本地写入的载荷:回声 watch 据此跳过自己的写(与回声到达时序无关) */
let lastLocalWrite = '';

// ---- 初始装载 + 外部变化同步 ----

function normalizeScripts(v: unknown): UserScript[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (s): s is UserScript => !!s && typeof s === 'object' && typeof (s as UserScript).id === 'string',
    )
    .map((s) => ({
      ...s,
      patterns: Array.isArray(s.patterns) ? s.patterns : [],
      runAt: normalizeRunAt(s.runAt),
    }));
}

/** 归一化发现坏数据 → 修复写回一次(写回的回声再进来时值已干净,天然收敛) */
function repairIfCorrupted(next: UserScript[], raw: unknown): void {
  if (raw === undefined || JSON.stringify(next) === JSON.stringify(raw)) return;
  void userScriptsItem.setValue(next);
}

void userScriptsItem.getValue().then((raw) => {
  const next = normalizeScripts(raw);
  scripts.value = next;
  repairIfCorrupted(next, raw);
});
void editingItem.getValue().then((v) => (editingId.value = v));

void userScriptsItem.watch((raw) => {
  const next = normalizeScripts(raw);
  if (JSON.stringify(next) === lastLocalWrite) return; // 自己写的回声,ref 已即时回填
  scripts.value = next;
  repairIfCorrupted(next, raw);
  // 外部上下文删除了正在编辑的脚本 → 回到清单视图
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
async function writeList(next: UserScript[]): Promise<void> {
  lastLocalWrite = JSON.stringify(next); // 先记指纹,setValue 的回声必然命中
  await userScriptsItem.setValue(next);
  scripts.value = next;
}

export function create(): Promise<UserScript> {
  return enqueue(async () => {
    const now = Date.now();
    const script: UserScript = {
      id: crypto.randomUUID(),
      name: '未命名脚本',
      enabled: false,
      patterns: ['<all_urls>'],
      code: '',
      runAt: 'document_idle',
      createdAt: now,
      updatedAt: now,
    };
    await writeList([...(await userScriptsItem.getValue()), script]);
    return script;
  });
}

export function update(
  id: string,
  patch: Partial<Pick<UserScript, 'name' | 'patterns' | 'code' | 'enabled' | 'runAt'>>,
): Promise<void> {
  return enqueue(async () => {
    const next = (await userScriptsItem.getValue()).map((s) =>
      s.id === id
        ? { ...s, ...patch, runAt: normalizeRunAt(patch.runAt ?? s.runAt), updatedAt: Date.now() }
        : s,
    );
    await writeList(next);
  });
}

export function remove(id: string): Promise<void> {
  return enqueue(async () => {
    const next = (await userScriptsItem.getValue()).filter((s) => s.id !== id);
    await writeList(next);
    // 不变式:编辑对象被删 → 清 editing(唯一一处;已在队列内,直写不嵌套排队)
    if (editingId.value === id) {
      await editingItem.setValue(null);
      editingId.value = null;
    }
  });
}

/** 执行顺序 = 列表顺序(列表靠后者后执行);delta -1 上移 / +1 下移,越界不动 */
export function move(id: string, delta: -1 | 1): Promise<void> {
  return enqueue(async () => {
    const list = await userScriptsItem.getValue();
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

// ---- 对外 interface ----

/**
 * 消费方获取 store(单例:多次调用同一份状态)。
 * scripts 为只读语义(请勿直接改写;变更一律走 create/update/remove/move)。
 */
export function useUserScripts() {
  return { scripts, editingId, create, update, remove, move, setEditing };
}

/** 读当前脚本列表(语义化读取):供注册表(background)使用 */
export function readScripts(): Promise<UserScript[]> {
  return userScriptsItem.getValue();
}
