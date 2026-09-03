// src/features/notes/store.ts

/**
 * notes 单例 store(issue #22,镜像 custom-styles 的 #18 定稿模式):
 * - 模块级单例:每页一份状态,消费方 useNotes() 拿同一份
 * - 写路径经全局队列串行,消跨上下文 read-modify-write 丢更新
 * - 本地写即时回填 ref;自己写入的回声按「载荷 = 最后本地写」跳过
 * - URL 归一化(去 hash)是 store 职责,不单独暴露纯函数(规格 #21)
 * - 幽灵态:新建不落 storage,首次 update 到非空 text 才持久化
 */
import { ref } from 'vue';
import { storage } from 'wxt/utils/storage';
import type { Note } from './types';

const NOTES_KEY = 'local:notes';
const ENABLED_KEY = 'local:notes:enabled';

/** storage item 私有:「存储即通道」是实现细节,消费方一律走 store interface */
const notesItem = storage.defineItem<Note[]>(NOTES_KEY, { fallback: [] });
/** 页面注入总开关(默认开):关闭只停悬浮卡片,数据保留(规格 #21) */
const enabledItem = storage.defineItem<boolean>(ENABLED_KEY, { fallback: true });

/** URL 归一化:绑定键为「去掉 hash 的完整 URL」(锚点跳转不失签) */
function normalizeUrl(url: string): string {
  const i = url.indexOf('#');
  return i === -1 ? url : url.slice(0, i);
}

// ---- 模块级状态(单例本体) ----

const notes = ref<Note[]>([]);
const enabled = ref(true);

/** 写队列:所有 CRUD 串行过这一条 promise 链 */
let writeQueue: Promise<void> = Promise.resolve();

/** 最近一次本地写入的载荷:回声 watch 据此跳过自己的写(与回声到达时序无关) */
let lastLocalWrite = '';

/** 幽灵便签注册表:text 非空前不落 storage(随手点开又关掉不留空签);仅创建方上下文可见 */
const ghosts = new Map<string, Note>();

// ---- 初始装载 + 外部变化同步 ----

void notesItem.getValue().then((v) => (notes.value = v ?? []));
void enabledItem.getValue().then((v) => (enabled.value = v ?? true));

void notesItem.watch((v) => {
  const next = v ?? [];
  if (JSON.stringify(next) === lastLocalWrite) return; // 自己写的回声,ref 已即时回填
  notes.value = next;
});
void enabledItem.watch((v) => {
  enabled.value = v ?? true;
});

// ---- 写路径(队列串行 + 即时回填) ----

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(op);
  // 队列永不断链:op 失败被吞,后续写照常
  writeQueue = run.then(() => {}, () => {});
  return run;
}

/** 队列 op 内的写辅助:记回声指纹 → 落 storage → 即时回填。仅限队列内调用 */
async function writeList(next: Note[]): Promise<void> {
  lastLocalWrite = JSON.stringify(next); // 先记指纹,setValue 的回声必然命中
  await notesItem.setValue(next);
  notes.value = next;
}

/** 幽灵态新建:text 空 → 只入幽灵注册表不落盘;带 text → 直落持久(无幽灵过渡) */
function create(url: string | null, text = ''): Promise<Note> {
  const now = Date.now();
  // 归一化是 store 职责:绑定键一律存去 hash 的 URL,消费方无需预洗
  const note: Note = {
    id: crypto.randomUUID(),
    url: url === null ? null : normalizeUrl(url),
    text,
    createdAt: now,
    updatedAt: now,
  };
  if (text === '') {
    ghosts.set(note.id, note);
    return Promise.resolve(note);
  }
  return enqueue(async () => {
    await writeList([...(await notesItem.getValue()), note]);
    return note;
  });
}

/** 输入即存语义的裸 update:刷 updatedAt;幽灵首次非空 text 即晋升持久 */
function update(id: string, text: string): Promise<void> {
  return enqueue(async () => {
    const ghost = ghosts.get(id);
    if (ghost) {
      if (text === '') return; // 仍在幽灵态,不落盘
      ghosts.delete(id);
      await writeList([...(await notesItem.getValue()), { ...ghost, text, updatedAt: Date.now() }]);
      return;
    }
    const current = await notesItem.getValue();
    if (!current.some((n) => n.id === id)) return; // 未知 id 空转,不产生无意义写入
    const next = current.map((n) => (n.id === id ? { ...n, text, updatedAt: Date.now() } : n));
    await writeList(next);
  });
}

function remove(id: string): Promise<void> {
  if (ghosts.delete(id)) return Promise.resolve(); // 幽灵被删 = 从未存在,storage 不动
  return enqueue(async () => {
    const current = await notesItem.getValue();
    if (!current.some((n) => n.id === id)) return; // 未知 id 空转,不产生无意义写入
    await writeList(current.filter((n) => n.id !== id));
  });
}

/** 总开关写入口:即时回填 + 落 storage(设置区块消费;watch 让 content script 即时跟随)。
 *  单写布尔,无 read-modify-write,不经 writeQueue(CRUD 队列只护列表读改写) */
function setEnabled(v: boolean): Promise<void> {
  enabled.value = v;
  return enabledItem.setValue(v);
}

// ---- 查询(只读派生,不写 storage) ----

/** updatedAt 倒序:最近动过的恒在最上(查询侧固定排序,规格 #21) */
function byRecency(list: Note[]): Note[] {
  return [...list].sort((x, y) => y.updatedAt - x.updatedAt);
}

/** 按归一化 URL 查页面便签(hash 差异不区分;query/path 不同即不同页) */
async function getByPage(url: string): Promise<Note[]> {
  const key = normalizeUrl(url);
  return byRecency((await notesItem.getValue()).filter((n) => n.url === key));
}

/** 查全局便签(url 为 null 的取值特例) */
async function getGlobal(): Promise<Note[]> {
  return byRecency((await notesItem.getValue()).filter((n) => n.url === null));
}

// ---- 对外 interface ----

/**
 * 消费方获取 store(单例:多次调用同一份状态)。
 * notes 为只读语义(请勿直接改写;变更一律走 create/update/remove)。
 */
export function useNotes() {
  return { notes, enabled, setEnabled, create, update, remove, getByPage, getGlobal };
}
