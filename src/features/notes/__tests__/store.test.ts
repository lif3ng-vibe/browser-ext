// src/features/notes/__tests__/store.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// store 是模块级单例:vi.resetModules 隔离每个用例的实例状态
async function freshStore() {
  vi.resetModules();
  const mod = await import('../store');
  return mod.useNotes();
}

describe('notes store:幽灵态生命周期(新建不落盘,首次写入才持久化)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('create 返回幽灵便签:id/time 齐,text 空,不落 storage', async () => {
    const api = await freshStore();
    const note = await api.create('https://a.com/p');
    expect(note.id).toBeTruthy();
    expect(note.url).toBe('https://a.com/p');
    expect(note.text).toBe('');
    expect(note.createdAt).toBeGreaterThan(0);
    expect(note.updatedAt).toBe(note.createdAt);

    const stored = await fakeBrowser.storage.local.get('notes');
    expect(stored.notes).toBeUndefined(); // 幽灵态:storage 无此 key
  });

  it('update 幽灵便签写入 text → 晋升持久,落 storage,updatedAt 刷新', async () => {
    const api = await freshStore();
    const note = await api.create(null);

    await new Promise((r) => setTimeout(r, 5));
    await api.update(note.id, '第一句话');

    const stored = await fakeBrowser.storage.local.get('notes');
    const list = stored.notes as unknown[];
    expect(list).toHaveLength(1);
    const saved = list[0] as { id: string; text: string; updatedAt: number };
    expect(saved.id).toBe(note.id);
    expect(saved.text).toBe('第一句话');
    expect(saved.updatedAt).toBeGreaterThanOrEqual(note.updatedAt + 5);
  });

  it('幽灵便签只被删除 → storage 从未出现此 key(从未存在)', async () => {
    const api = await freshStore();
    const note = await api.create('https://a.com/p');
    await api.remove(note.id);

    const stored = await fakeBrowser.storage.local.get('notes');
    expect(stored.notes).toBeUndefined();
  });

  it('create 带 text 直落持久(无幽灵过渡)', async () => {
    const api = await freshStore();
    const note = await api.create(null, '直接有内容');

    expect(note.text).toBe('直接有内容');
    const stored = await fakeBrowser.storage.local.get('notes');
    expect((stored.notes as unknown[]).length).toBe(1);
  });
});

describe('notes store:归一化查询 + 排序(store 外部行为)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('存 #x 后,以无 hash 与 #y 查询均命中同一条;query/path 不同不命中', async () => {
    const api = await freshStore();
    const a = await api.create('https://a.com/p#x', '甲');
    await api.create('https://b.com/q', '乙');

    const hitNoHash = await api.getByPage('https://a.com/p');
    expect(hitNoHash.map((n) => n.id)).toEqual([a.id]);
    const hitOtherHash = await api.getByPage('https://a.com/p#y');
    expect(hitOtherHash.map((n) => n.id)).toEqual([a.id]);
    const missQuery = await api.getByPage('https://a.com/p?tab=1');
    expect(missQuery).toEqual([]);
    const missPath = await api.getByPage('https://a.com/other');
    expect(missPath).toEqual([]);
  });

  it('getByPage 不混入全局便签;getGlobal 只含全局便签', async () => {
    const api = await freshStore();
    const page = await api.create('https://a.com/p', '页签');
    const global = await api.create(null, '全局签');

    const byPage = await api.getByPage('https://a.com/p');
    expect(byPage.map((n) => n.id)).toEqual([page.id]);
    const globals = await api.getGlobal();
    expect(globals.map((n) => n.id)).toEqual([global.id]);
  });

  it('查询结果恒按 updatedAt 倒序', async () => {
    const api = await freshStore();
    const a = await api.create('https://a.com/p', 'first');
    const b = await api.create('https://a.com/p', 'second');
    expect(a.updatedAt).toBeLessThanOrEqual(b.updatedAt);

    await api.update(a.id, 'first 已更新');
    const list = await api.getByPage('https://a.com/p');
    expect(list.map((n) => n.id)).toEqual([a.id, b.id]); // 最近动过的在最上

    const globals = await api.getGlobal();
    expect(globals).toEqual([]);
  });

  it('持久便签 update:text 替换 + updatedAt 刷新,其余字段不动', async () => {
    const api = await freshStore();
    const a = await api.create('https://a.com/p', '旧文');

    await new Promise((r) => setTimeout(r, 5));
    await api.update(a.id, '新文');

    const list = await api.getByPage('https://a.com/p');
    const saved = list.find((n) => n.id === a.id)!;
    expect(saved.text).toBe('新文');
    expect(saved.updatedAt).toBeGreaterThanOrEqual(a.updatedAt + 5);
    expect(saved.createdAt).toBe(a.createdAt);
    expect(saved.url).toBe('https://a.com/p');
  });

  it('update 未知 id:不抛错、storage 不动(空转守卫)', async () => {
    const api = await freshStore();
    await api.create('https://a.com/p', '在册');
    const before = await fakeBrowser.storage.local.get('notes');

    await api.update('no-such-id', '乱入');
    expect(await fakeBrowser.storage.local.get('notes')).toEqual(before);
  });

  it('getByPage/getGlobal 只读派生,不写 storage', async () => {
    const api = await freshStore();
    await api.create('https://a.com/p', '页签');

    await api.getByPage('https://a.com/p');
    await api.getGlobal();
    const stored = await fakeBrowser.storage.local.get('notes');
    expect((stored.notes as unknown[]).length).toBe(1);
  });
});

describe('notes store:跨上下文(镜像 custom-styles 并发用例风格)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('写队列串行:并发 create 不丢更新', async () => {
    const api = await freshStore();

    await Promise.all([api.create('https://a.com/p', '甲'), api.create(null, '乙'), api.create('https://a.com/p', '丙')]);

    const stored = await fakeBrowser.storage.local.get('notes');
    expect((stored.notes as unknown[]).length).toBe(3);
  });

  it('外部上下文直接写 storage → watch 同步本页 notes ref', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.notes.value).toEqual([]));

    // 绕过 store,模拟另一上下文(popup)直接写 storage
    await fakeBrowser.storage.local.set({
      notes: [{ id: 'x', url: null, text: '外部', createdAt: 1, updatedAt: 1 }],
    });

    await vi.waitFor(() => expect(api.notes.value).toHaveLength(1));
    expect(api.notes.value[0]!.id).toBe('x');
  });

  it('总开关读取位:enabled ref 跟随 storage(默认开)', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.enabled.value).toBe(true));

    await fakeBrowser.storage.local.set({ 'notes:enabled': false });
    await vi.waitFor(() => expect(api.enabled.value).toBe(false));
  });
});
