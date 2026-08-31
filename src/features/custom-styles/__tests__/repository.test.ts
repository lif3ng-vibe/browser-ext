// src/features/custom-styles/__tests__/repository.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createStyle,
  editingItem,
  listStyles,
  moveStyle,
  removeStyle,
  updateStyle,
} from '../repository';

describe('custom-styles repository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('createStyle 默认值:未命名/禁用/全局作用域,并追加到列表尾', async () => {
    const a = await createStyle();
    const b = await createStyle();
    const all = await listStyles();
    expect(a.name).toBe('未命名样式');
    expect(a.enabled).toBe(false);
    expect(a.patterns).toEqual(['<all_urls>']);
    expect(all.map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it('updateStyle 写入 patch 并刷新 updatedAt', async () => {
    const s = await createStyle();
    await new Promise((r) => setTimeout(r, 5));
    await updateStyle(s.id, { name: '红字', code: 'body{color:red}', enabled: true });
    const [saved] = await listStyles();
    expect(saved!.name).toBe('红字');
    expect(saved!.code).toBe('body{color:red}');
    expect(saved!.enabled).toBe(true);
    expect(saved!.updatedAt).toBeGreaterThanOrEqual(s.updatedAt + 5);
  });

  it('moveStyle 边界越界不动,普通交换生效', async () => {
    const a = await createStyle();
    const b = await createStyle();
    const c = await createStyle();
    await moveStyle(c.id, 1); // 越下界(delta=1 时已在末尾),顺序不变
    let ids = (await listStyles()).map((s) => s.id);
    expect(ids).toEqual([a.id, b.id, c.id]);
    await moveStyle(c.id, -1);
    ids = (await listStyles()).map((s) => s.id);
    expect(ids).toEqual([a.id, c.id, b.id]);
  });

  it('removeStyle 移除并清理 editing 指针', async () => {
    const a = await createStyle();
    await editingItem.setValue(a.id);
    await removeStyle(a.id);
    expect(await listStyles()).toEqual([]);
    expect(await editingItem.getValue()).toBeNull();
  });
});