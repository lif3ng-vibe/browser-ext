/*
 * shared/theme —— 主题系统的无头基础层(ADR-0004)。
 * 所有 UI(含未来 content UI)只准从这里消费主题;设置 UI 住 features/settings。
 *
 * 决议速查:
 * - 平铺 + 主题对:主题名 -light/-dark 结尾标明倾向;pair 指向配对主题
 * - 「跟随系统」是独立布尔,开启时在所选主题对内按系统明暗解析
 * - 存储:local:lif3ng/theme + local:lif3ng/followSystem;解析值双写
 *   storage(跨上下文)+ localStorage 镜像(供 FOUC 阻塞脚本同步读)
 */