// src/features/custom-styles/__tests__/store.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// store 是模块级单例:vi.resetModules 隔离每个用例的实例状态
async function freshStore() {
  vi.resetModules();
  const mod = await import('../store');
  return mod.useCustomStyles();
}

describe('custom-styles store(单例,跨上下文同步)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('初始:styles 为空数组,editingId 为 null', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    expect(api.editingId.value).toBeNull();
  });

  it('create:默认值 + 追加尾;styles ref 即时回填(不等 storage 回声)', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));

    const a = await api.create();
    expect(api.styles.value.map((s) => s.id)).toEqual([a.id]); // 本地即时,非回声
    expect(a.name).toBe('未命名样式');
    expect(a.enabled).toBe(false);
    expect(a.patterns).toEqual(['<all_urls>']);
  });

  it('update:写 patch 刷 updatedAt,ref 即时回填', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();

    await new Promise((r) => setTimeout(r, 5));
    await api.update(a.id, { name: '红字', code: 'body{color:red}', enabled: true });

    const saved = api.styles.value[0]!;
    expect(saved.name).toBe('红字');
    expect(saved.code).toBe('body{color:red}');
    expect(saved.enabled).toBe(true);
    expect(saved.updatedAt).toBeGreaterThanOrEqual(a.updatedAt + 5);
  });

  it('move:越界不动,相邻交换', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const b = await api.create();
    const c = await api.create();

    await api.move(c.id, 1); // 越下界,不动
    expect(api.styles.value.map((s) => s.id)).toEqual([a.id, b.id, c.id]);
    await api.move(c.id, -1);
    expect(api.styles.value.map((s) => s.id)).toEqual([a.id, c.id, b.id]);
  });

  it('remove:移除样式并清指向它的 editingId(不变式一处)', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    await api.setEditing(a.id);
    expect(api.editingId.value).toBe(a.id);

    await api.remove(a.id);
    expect(api.styles.value).toEqual([]);
    expect(api.editingId.value).toBeNull();
  });

  it('setEditing:null 与 id 均即时回填', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();

    await api.setEditing(a.id);
    expect(api.editingId.value).toBe(a.id);
    await api.setEditing(null);
    expect(api.editingId.value).toBeNull();
  });

  it('外部上下文直接写 storage → watch 同步本页 ref', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));

    // 绕过 store,模拟另一上下文(popup)直接写 storage
    await fakeBrowser.storage.local.set({
      customStyles: [{ id: 'x', name: 'n', enabled: true, patterns: [], code: '', createdAt: 1, updatedAt: 1 }],
    });

    await vi.waitFor(() => expect(api.styles.value).toHaveLength(1));
    expect(api.styles.value[0]!.id).toBe('x');
  });

  it('写队列串行:并发 create 不丢更新', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));

    await Promise.all([api.create(), api.create(), api.create()]);

    expect(api.styles.value).toHaveLength(3);
    const stored = await fakeBrowser.storage.local.get('customStyles');
    expect((stored.customStyles as unknown[]).length).toBe(3);
  });

  it('读路径防御:storage 坏记录(patterns 非数组)装载时归一为 [] 并修复写回', async () => {
    // 历史遗留坏数据:patterns 为字符串 → 此前 StyleEditor setup 的 join 直接炸(打开侧边栏即白屏)
    await fakeBrowser.storage.local.set({
      customStyles: [
        { id: 'bad', name: '坏', enabled: true, patterns: '*://a.com/*', code: '', createdAt: 1, updatedAt: 1 },
        { id: 'good', name: '好', enabled: true, patterns: ['<all_urls>'], code: '', createdAt: 1, updatedAt: 1 },
      ],
    });
    const api = await freshStore();

    await vi.waitFor(() => expect(api.styles.value).toHaveLength(2));
    expect(api.styles.value.find((s) => s.id === 'bad')!.patterns).toEqual([]);
    expect(api.styles.value.find((s) => s.id === 'good')!.patterns).toEqual(['<all_urls>']);

    // 修复写回:storage 里的坏值也归一
    await vi.waitFor(async () => {
      const stored = await fakeBrowser.storage.local.get('customStyles');
      const list = stored.customStyles as { id: string; patterns: string[] }[];
      expect(list.find((s) => s.id === 'bad')!.patterns).toEqual([]);
      expect(list.find((s) => s.id === 'good')!.patterns).toEqual(['<all_urls>']);
    });
  });

  it('读路径防御:外部上下文写入坏 patterns → watch 回填同样归一化', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));

    await fakeBrowser.storage.local.set({
      customStyles: [{ id: 'x', name: 'n', enabled: true, patterns: 'nonsense', code: '', createdAt: 1, updatedAt: 1 }],
    });

    await vi.waitFor(() => expect(api.styles.value).toHaveLength(1));
    expect(api.styles.value[0]!.patterns).toEqual([]);
  });

  it('读路径防御:非对象条目丢弃;整体非数组归一为空', async () => {
    await fakeBrowser.storage.local.set({
      customStyles: [null, 'bad', { id: 'ok', name: 'n', enabled: true, patterns: [], code: '', createdAt: 1, updatedAt: 1 }],
    });
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value.map((s) => s.id)).toEqual(['ok']));

    await fakeBrowser.storage.local.set({ customStyles: 'garbage' });
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
  });
});

describe('importStyles(#14 导入)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('按 id 合并:同 id 覆盖位置不动,新增追加尾部,计数正确,ref 即时回填', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const b = await api.create();

    const incoming = [
      { ...a, name: '文件版' },
      { id: 'new-1', name: '新', enabled: false, patterns: [], code: '', createdAt: 1, updatedAt: 1 },
    ];
    const summary = await api.importStyles(incoming);
    expect(summary).toEqual({ overridden: 1, added: 1 });
    expect(api.styles.value.map((s) => s.id)).toEqual([a.id, b.id, 'new-1']);
    expect(api.styles.value[0]!.name).toBe('文件版');

    const stored = await fakeBrowser.storage.local.get('customStyles');
    expect((stored.customStyles as unknown[]).length).toBe(3);
  });

  it('幂等:同一清单导两次,第二次全为覆盖,清单不变', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const incoming = [{ ...a, name: '文件版' }];
    await api.importStyles(incoming);
    const second = await api.importStyles(incoming);
    expect(second).toEqual({ overridden: 1, added: 0 });
    expect(api.styles.value.map((s) => s.name)).toEqual(['文件版']);
  });

  it('不变式:文件替换了正在编辑的样式 → editingId 清空;未涉及 → 保留', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const b = await api.create();

    // 导入只含 a' → 正在编辑的 b 不受影响
    await api.setEditing(b.id);
    await api.importStyles([{ ...a, name: '文件版' }]);
    expect(api.editingId.value).toBe(b.id);

    // 导入含 b' → 编辑会话结束(推广 remove 的不变式)
    await api.importStyles([{ ...b, name: '文件乙' }]);
    expect(api.editingId.value).toBeNull();
  });
});
