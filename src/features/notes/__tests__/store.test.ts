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
