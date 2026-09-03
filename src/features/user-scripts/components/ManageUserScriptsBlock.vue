<!-- src/features/user-scripts/components/ManageUserScriptsBlock.vue -->
<script lang="ts" setup>
/**
 * 用户脚本管理区块(#13):options 聚合页专属(规格:不做 sidepanel/popup 入口)。
 * 门禁三态横幅 + 列表 + 行内编辑 + 删除页内确认(ManageStylesBlock 同构先例:
 * 嵌入式 options iframe 里原生 dialog 被静默抑制)。
 */
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import UserScriptList from './UserScriptList.vue';
import UserScriptEditor from './UserScriptEditor.vue';
import { useUserScripts } from '../store';
import { checkGate, type GateStatus } from '../gate';
import { RESYNC_MSG } from '../messages';

const store = useUserScripts();

const gate = ref<GateStatus>('available');
const firefoxMode = computed(
  () => !!(browser as Partial<{ sidebarAction?: unknown }>).sidebarAction,
);

onMounted(async () => {
  gate.value = await checkGate();
  // 门禁开通与否浏览器不通知:挂载即发 resync,background 补一次全量重建。
  // 覆盖 Chrome「开通后回到此页刷新」路径——此时注册表可能还是空的(规格:注册表纯派生态)
  try {
    await browser.runtime.sendMessage({ type: RESYNC_MSG });
  } catch {
    /* background 不可达(如单测)→ 无妨,storage 变更路径兜底 */
  }
});

/** Firefox:申请 optional userScripts 权限(需用户手势,按钮点击即是) */
async function requestFirefoxPermission() {
  try {
    const granted = await browser.permissions.request({ permissions: ['userScripts'] });
    if (granted) {
      gate.value = 'available';
      await browser.runtime.sendMessage({ type: RESYNC_MSG });
    }
  } catch {
    /* 拒绝/失败 → 维持 locked 横幅 */
  }
}

/**
 * Firefox 判定:sidebarAction 仅 Firefox 存在(WXT chrome 类型无此 API,
 * custom-styles/openManagerPanel 同款代理判据)。
 */

const editing = computed(() =>
  store.scripts.value.find((s) => s.id === store.editingId.value) ?? null,
);

async function createAndEdit() {
  const s = await store.create();
  await store.setEditing(s.id);
}

/** 删除请求 → 页内确认条(同 ManageStylesBlock) */
interface PendingConfirm {
  msg: string;
  action: () => Promise<void>;
}
const pendingConfirm = ref<PendingConfirm | null>(null);

function requestRemove(id: string) {
  const target = store.scripts.value.find((s) => s.id === id);
  if (!target) return;
  pendingConfirm.value = {
    msg: `删除「${target.name}」?不可恢复。`,
    action: () => store.remove(id),
  };
}

async function acceptConfirm() {
  const pending = pendingConfirm.value;
  if (!pending) return;
  pendingConfirm.value = null;
  await pending.action();
}

function cancelConfirm() {
  pendingConfirm.value = null;
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        用户脚本
      </CardTitle>
      <CardDescription>按作用域注入自写 JS;保存后下次页面加载生效</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <!-- 平台门禁横幅:locked = 需用户开通;unavailable = 浏览器不支持 -->
      <div
        v-if="gate === 'locked' && firefoxMode"
        data-testid="gate-banner"
        class="border-border rounded-md border p-2 text-sm"
      >
        <p>用户脚本权限未开通。点击启用后即可注入:</p>
        <Button
          size="sm"
          class="mt-2"
          @click="requestFirefoxPermission"
        >
          启用用户脚本权限
        </Button>
      </div>
      <div
        v-else-if="gate === 'locked'"
        data-testid="gate-banner"
        class="border-border rounded-md border p-2 text-sm"
      >
        <p>浏览器尚未允许本扩展运行用户脚本,当前列表不会生效。请到扩展管理页开通:</p>
        <p class="text-muted-foreground mt-1 text-xs">
          chrome://extensions → 本扩展「详情」→ 打开「允许用户脚本」(旧版 Chrome 在扩展页开「开发者模式」),开通后回到此页刷新。
        </p>
      </div>
      <div
        v-else-if="gate === 'unavailable'"
        data-testid="gate-banner"
        class="border-border rounded-md border p-2 text-sm"
      >
        <p>此浏览器不支持用户脚本 API,列表仅作保存,不会注入。</p>
      </div>

      <UserScriptEditor
        v-if="editing"
        :key="editing.id"
        :record="editing"
      />
      <template v-else>
        <UserScriptList
          :scripts="store.scripts.value"
          @toggle="(id, on) => store.update(id, { enabled: on })"
          @edit="(id) => store.setEditing(id)"
          @remove="requestRemove"
          @move="(id, d) => store.move(id, d)"
          @run-at="(id, r) => store.update(id, { runAt: r })"
        />
        <div
          v-if="pendingConfirm"
          data-testid="confirm-banner"
          class="border-border rounded-md border p-2"
        >
          <p class="text-sm">
            {{ pendingConfirm.msg }}
          </p>
          <div class="mt-2 flex gap-2">
            <Button
              size="sm"
              @click="acceptConfirm"
            >
              确认删除
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click="cancelConfirm"
            >
              取消
            </Button>
          </div>
        </div>
        <Button
          variant="outline"
          @click="createAndEdit"
        >
          新建脚本
        </Button>
      </template>
    </CardContent>
  </Card>
</template>
