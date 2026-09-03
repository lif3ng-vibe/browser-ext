// src/features/user-scripts/__tests__/store.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// store 是模块级单例:vi.resetModules 隔离每个用例的实例状态
async function freshStore() {
  vi.resetModules();
  const mod = await import('../store');
  return mod.useUserScripts();
}

describe('user-scripts store(单例,镜像 custom-styles 定稿模式)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('初始:scripts 为空数组,editingId 为 null', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    expect(api.editingId.value).toBeNull();
  });

  it('create:默认值(含 runAt=document_idle)+ 追加尾;ref 即时回填', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));

    const a = await api.create();
    expect(api.scripts.value.map((s) => s.id)).toEqual([a.id]); // 本地即时,非回声
    expect(a.name).toBe('未命名脚本');
    expect(a.enabled).toBe(false);
    expect(a.patterns).toEqual(['<all_urls>']);
    expect(a.code).toBe('');
    expect(a.runAt).toBe('document_idle');
  });

  it('update:patch 刷 updatedAt,ref 即时回填', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    const a = await api.create();

    await new Promise((r) => setTimeout(r, 5));
    await api.update(a.id, { name: '去广告', code: 'console.log(1)', enabled: true, runAt: 'document_start' });

    const saved = api.scripts.value[0]!;
    expect(saved.name).toBe('去广告');
    expect(saved.code).toBe('console.log(1)');
    expect(saved.enabled).toBe(true);
    expect(saved.runAt).toBe('document_start');
    expect(saved.updatedAt).toBeGreaterThanOrEqual(a.updatedAt + 5);
  });

  it('update:非法 runAt 被拒绝(保持原值)——runAt 只有三档', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    const a = await api.create();

    await api.update(a.id, { runAt: 'whenever' as never });
    expect(api.scripts.value[0]!.runAt).toBe('document_idle');
  });

  it('move:越界不动,相邻交换', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    const a = await api.create();
    const b = await api.create();
    const c = await api.create();

    await api.move(c.id, 1); // 越下界,不动
    expect(api.scripts.value.map((s) => s.id)).toEqual([a.id, b.id, c.id]);
    await api.move(c.id, -1);
    expect(api.scripts.value.map((s) => s.id)).toEqual([a.id, c.id, b.id]);
  });

  it('remove:删编辑中脚本 → editingId 清空回清单', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    const a = await api.create();
    await api.setEditing(a.id);

    await api.remove(a.id);
    expect(api.scripts.value).toEqual([]);
    expect(api.editingId.value).toBeNull();
    expect(await fakeBrowser.storage.local.get('userScripts')).toEqual({ userScripts: [] });
  });

  it('读路径归一化防御:patterns 坏数据(字符串)归一为 [],条目保留', async () => {
    vi.resetModules();
    await fakeBrowser.storage.local.set({
      userScripts: [
        { id: 'a', name: '好', enabled: true, patterns: ['<all_urls>'], code: 'x', runAt: 'document_idle', createdAt: 1, updatedAt: 1 },
        { id: 'b', name: '坏 patterns', enabled: true, patterns: 'github.com', code: 'y', runAt: 'document_idle', createdAt: 1, updatedAt: 1 },
        '垃圾条目',
      ],
    });
    const api = await freshStore();
    await vi.waitFor(() =>
      expect(api.scripts.value.map((s) => s.id)).toEqual(['a', 'b']),
    );
    expect(api.scripts.value[1]!.patterns).toEqual([]);
  });

  it('runAt 坏数据归一为默认 document_idle', async () => {
    vi.resetModules();
    await fakeBrowser.storage.local.set({
      userScripts: [
        { id: 'a', name: 'n', enabled: true, patterns: [], code: '', runAt: 'sometime', createdAt: 1, updatedAt: 1 },
      ],
    });
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value.length).toBe(1));
    expect(api.scripts.value[0]!.runAt).toBe('document_idle');
  });

  it('跨上下文同步:外部 storage 写入 → ref 跟随(编辑对象被外部删除 → 清 editing)', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    const a = await api.create();
    await api.setEditing(a.id);

    await fakeBrowser.storage.local.set({ userScripts: [] });
    await vi.waitFor(() => {
      expect(api.scripts.value).toEqual([]);
      expect(api.editingId.value).toBeNull();
    });
  });

  it('storage key 隔离:不与 custom-styles 共用键', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.scripts.value).toEqual([]));
    await api.create();
    const stored = await fakeBrowser.storage.local.get(null);
    expect(Object.keys(stored)).toContain('userScripts');
    expect(Object.keys(stored)).not.toContain('customStyles');
  });
});
