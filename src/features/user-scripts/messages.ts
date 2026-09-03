/** options → background 的消息协议(门禁开通后手动触发重建) */
export const RESYNC_MSG = 'userScripts:resync';
export type ResyncMessage = { type: typeof RESYNC_MSG };

/** 消息校验:手写 type guard,拒绝 as 强转(custom-styles messages 先例) */
export function isResyncMessage(raw: unknown): raw is ResyncMessage {
  return typeof raw === 'object' && raw !== null && (raw as Record<string, unknown>).type === RESYNC_MSG;
}
