/** side panel/popup → content script 的消息协议 */
export const PREVIEW_MSG = {
  PREVIEW: 'customStyles:preview',
  CLEAR: 'customStyles:previewClear',
} as const;
export type PreviewMessage =
  | { type: typeof PREVIEW_MSG.PREVIEW; css: string }
  | { type: typeof PREVIEW_MSG.CLEAR };