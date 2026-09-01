// src/shared/editor/useEditorWrap.ts
import { ref } from 'vue';
import { storage } from 'wxt/utils/storage';

/** 代码编辑区自动折行偏好(全局设置,各 Feature 的代码输入区共用) */
export const editorWrapItem = storage.defineItem<boolean>('local:lif3ng/editorWrap', {
  fallback: true,
});

export function useEditorWrap() {
  const wrap = ref(true);
  void editorWrapItem.getValue().then((v) => (wrap.value = v));
  return {
    wrap,
    setWrap: (v: boolean) => {
      wrap.value = v;
      return editorWrapItem.setValue(v);
    },
  };
}
