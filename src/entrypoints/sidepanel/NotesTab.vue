<!-- 便签 tab 定稿形态(issue #25 T4;T3 #24 最小本页列表长成)。
     住薄壳而非 notes Feature:#21「组合逻辑只住薄壳」,侧栏聚合的视图组合归薄壳。
     上部本页便签主视图 + 空态引导,下部全局便签分区默认收起,展开同览。 -->
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Button } from '@/shared/ui/button';
import { useActiveTab } from '@/shared/useActiveTab';
import NoteEditor from '@/features/notes/components/NoteEditor.vue';
import { useNotes } from '@/features/notes/store';
import type { Note } from '@/features/notes/types';

const store = useNotes();
const activeTab = useActiveTab();

// ---- 本页便签(主视图) ----

// 视图派生(NoteCard 同款):storage 重查 wholesale 替换;幽灵(未输入)只在创建方上下文乐观展示
const pageNotes = ref<Note[]>([]);
const pageGhosts = ref<Note[]>([]);
const displayPageNotes = computed(() => [...pageNotes.value, ...pageGhosts.value]);

/** 换页判定键:活动 tab URL 去 hash(镜像 store 的归一化规则,仅此一处本地比较用;
 *  绑定键本身仍由 store 归一化,消费方拿到的便签 url 字段永远是归一化产物) */
const pageKey = computed(() => {
  const url = activeTab.value?.url;
  if (!url) return undefined;
  const i = url.indexOf('#');
  return i === -1 ? url : url.slice(0, i);
});

let lastPageKey: string | undefined;

async function requeryPage() {
  const url = activeTab.value?.url;
  // 换页(归一化键变化):幽灵退役(NoteCard 先例——幽灵只属于创建它的页面)
  if (pageKey.value !== lastPageKey) pageGhosts.value = [];
  lastPageKey = pageKey.value;
  pageNotes.value = url ? await store.getByPage(url) : [];
  // 幽灵晋升后同 id 已在 storage:从乐观列表退役
  pageGhosts.value = pageGhosts.value.filter((g) => !pageNotes.value.some((n) => n.id === g.id));
}

watch(
  () => [store.notes.value, activeTab.value?.url] as const,
  () => void requeryPage(),
);
void requeryPage();

/** 幽灵态新建:绑定当前 tab URL,text 非空前不落 storage */
async function createPageNote() {
  const url = activeTab.value?.url;
  if (!url) return;
  const ghost = await store.create(url);
  pageGhosts.value.push(ghost);
}

/** NoteEditor removed 事件:从乐观列表退役(持久删除走 storage watch 重查) */
function retirePageGhost(id: string) {
  pageGhosts.value = pageGhosts.value.filter((g) => g.id !== id);
}

// ---- 全局便签分区(默认收起,展开同览) ----

const globalExpanded = ref(false);

const globalNotes = ref<Note[]>([]);
const globalGhosts = ref<Note[]>([]);
const displayGlobalNotes = computed(() => [...globalNotes.value, ...globalGhosts.value]);

async function requeryGlobal() {
  globalNotes.value = await store.getGlobal();
  globalGhosts.value = globalGhosts.value.filter((g) => !globalNotes.value.some((n) => n.id === g.id));
}

watch(
  () => store.notes.value,
  () => void requeryGlobal(),
);
void requeryGlobal();

/** 全局便签幽灵态新建:url 为 null 的取值特例 */
async function createGlobalNote() {
  const ghost = await store.create(null);
  globalGhosts.value.push(ghost);
}

function retireGlobalGhost(id: string) {
  globalGhosts.value = globalGhosts.value.filter((g) => g.id !== id);
}
</script>

<template>
  <div
    data-testid="notes-tab-content"
    class="flex flex-col gap-3"
  >
    <!-- 上部:本页便签主视图 -->
    <section
      data-testid="page-notes"
      class="flex flex-col gap-2"
    >
      <h1 class="text-base font-medium">
        便签
      </h1>
      <p class="text-muted-foreground truncate text-xs">
        {{ activeTab?.url ?? '无活动标签页' }}
      </p>
      <div class="flex flex-col gap-2">
        <NoteEditor
          v-for="n in displayPageNotes"
          :key="n.id"
          :note="n"
          @removed="retirePageGhost"
        />
        <p
          v-if="!displayPageNotes.length"
          class="text-muted-foreground text-sm"
        >
          此页无便签
        </p>
      </div>
      <Button
        variant="outline"
        :disabled="!activeTab?.url"
        aria-label="新建页面便签"
        @click="createPageNote"
      >
        新建页面便签
      </Button>
    </section>

    <!-- 下部:全局便签分区,默认收起 -->
    <section
      data-testid="global-notes"
      class="border-border flex flex-col gap-2 rounded-lg border p-2"
    >
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground flex items-center justify-between text-sm font-medium"
        :aria-expanded="globalExpanded"
        @click="globalExpanded = !globalExpanded"
      >
        全局便签
        <span class="text-xs">{{ globalExpanded ? '收起' : '展开' }}</span>
      </button>
      <template v-if="globalExpanded">
        <div class="flex flex-col gap-2">
          <NoteEditor
            v-for="n in displayGlobalNotes"
            :key="n.id"
            :note="n"
            @removed="retireGlobalGhost"
          />
          <p
            v-if="!displayGlobalNotes.length"
            class="text-muted-foreground text-sm"
          >
            还没有全局便签
          </p>
        </div>
        <Button
          variant="outline"
          aria-label="新建全局便签"
          @click="createGlobalNote"
        >
          新建全局便签
        </Button>
      </template>
    </section>
  </div>
</template>
