// src/features/custom-styles/useCustomStyles.ts
import { ref } from 'vue';
import type { CustomStyle } from './types';
import {
  createStyle,
  customStylesItem,
  editingItem,
  moveStyle,
  removeStyle,
  updateStyle,
} from './repository';

/** storage 支撑的响应式仓库:列表与编辑指针跨上下文(popup/options/panel)自动同步 */
export function useCustomStyles() {
  const styles = ref<CustomStyle[]>([]);
  const editingId = ref<string | null>(null);

  void customStylesItem.getValue().then((v) => (styles.value = v));
  void customStylesItem.watch((v) => {
    styles.value = v ?? [];
    // 编辑对象被删 → 回到清单视图
    if (v && editingId.value && !v.some((s) => s.id === editingId.value)) {
      void editingItem.setValue(null);
    }
  });
  void editingItem.getValue().then((v) => (editingId.value = v));
  void editingItem.watch((v) => (editingId.value = v));

  return {
    styles,
    editingId,
    create: createStyle,
    update: updateStyle,
    remove: removeStyle,
    move: moveStyle,
    setEditing: (id: string | null) => editingItem.setValue(id),
  };
}