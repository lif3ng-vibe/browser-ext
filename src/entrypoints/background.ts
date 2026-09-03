import { setupRegistrySync } from '@/features/user-scripts/backgroundWiring';

export default defineBackground({
  main() {
    setupRegistrySync(); // 用户脚本注册表:冷启动/onInstalled/storage 变更全量重建(#13)
  },
});
