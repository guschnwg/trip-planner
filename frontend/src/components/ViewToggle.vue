<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: '' },
  narrow: { type: Boolean, default: false },
  forceMode: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const isMobile = ref(false);
const open = ref(false);
const rootEl = ref(null);
const triggerEl = ref(null);
const menuStyle = ref({});

let mediaQuery = null;
let mediaHandler = null;
let resizeHandler = null;
let scrollHandler = null;

const MOBILE_QUERY = '(max-width: 768px)';

const updateMatch = () => {
  if (props.forceMode === 'buttons' || props.forceMode === 'dropdown') {
    isMobile.value = props.forceMode === 'dropdown';
    return;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    isMobile.value = false;
    return;
  }
  isMobile.value = window.matchMedia(MOBILE_QUERY).matches;
};

const recomputePosition = async () => {
  if (!open.value || !triggerEl.value) return;
  await nextTick();
  const rect = triggerEl.value.getBoundingClientRect();
  menuStyle.value = {
    position: 'fixed',
    top: `${Math.round(rect.bottom + 6)}px`,
    right: `${Math.round(12)}px`,
    minWidth: `${Math.round(rect.width)}px`,
  };
};

const close = () => {
  open.value = false;
};

const toggle = () => {
  if (open.value) {
    close();
    return;
  }
  open.value = true;
  recomputePosition();
};

const choose = (value) => {
  if (value !== props.modelValue) emit('update:modelValue', value);
  close();
};

const onDocClick = (event) => {
  if (!open.value) return;
  const root = rootEl.value;
  if (root && !root.contains(event.target)) close();
};

const onKeydown = (event) => {
  if (event.key === 'Escape' && open.value) close();
};

onMounted(() => {
  updateMatch();
  if (typeof window === 'undefined') return;
  if (typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia(MOBILE_QUERY);
    mediaHandler = (e) => {
      if (props.forceMode === 'buttons' || props.forceMode === 'dropdown') {
        isMobile.value = props.forceMode === 'dropdown';
        return;
      }
      isMobile.value = e.matches;
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaHandler);
    }
  }
  resizeHandler = () => recomputePosition();
  scrollHandler = () => recomputePosition();
  window.addEventListener('resize', resizeHandler);
  window.addEventListener('scroll', scrollHandler, true);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  if (mediaQuery && mediaHandler) {
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', mediaHandler);
    } else if (typeof mediaQuery.removeListener === 'function') {
      mediaQuery.removeListener(mediaHandler);
    }
  }
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler, true);
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKeydown);
  mediaQuery = null;
  mediaHandler = null;
  resizeHandler = null;
  scrollHandler = null;
});

const selected = computed(() =>
  props.options.find((o) => o.value === props.modelValue) ?? props.options[0],
);
</script>

<template>
  <div ref="rootEl" class="view-toggle-wrap">
    <div
      v-if="!isMobile"
      class="view-toggle"
      :class="{ 'view-toggle--narrow': narrow }"
    >
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="view-btn"
        :class="{ active: modelValue === opt.value }"
        @click="emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-else class="view-toggle-dropdown">
      <button
        ref="triggerEl"
        type="button"
        class="view-toggle-trigger"
        :aria-expanded="open"
        :aria-label="ariaLabel || undefined"
        @click="toggle"
      >
        <span>{{ selected?.label }}</span>
        <svg
          class="view-toggle-caret"
          :class="{ open }"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <Teleport to="body">
        <ul
          v-if="open"
          class="view-toggle-menu"
          role="listbox"
          :style="menuStyle"
        >
          <li
            v-for="opt in options"
            :key="opt.value"
            role="option"
            :aria-selected="modelValue === opt.value"
            :class="{ active: modelValue === opt.value }"
            @click="choose(opt.value)"
          >
            {{ opt.label }}
          </li>
        </ul>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.view-toggle-wrap {
  position: relative;
  display: inline-flex;
}

.view-toggle {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-sm);
}

.view-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  background: transparent;
  border: 0;
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.view-toggle--narrow .view-btn {
  padding: 4px 10px;
  font-size: 11px;
}

.view-btn:hover:not(.active) {
  color: var(--color-text);
  background: var(--color-primary-soft);
}

.view-btn.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: var(--color-text-inverse);
  box-shadow: 0 4px 14px var(--color-primary-glow);
}

.view-toggle-dropdown {
  position: relative;
  display: inline-flex;
}

.view-toggle-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  color: var(--color-text);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.view-toggle-trigger:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-strong);
}

.view-toggle-caret {
  transition: transform var(--dur-base) var(--ease-out);
}

.view-toggle-caret.open {
  transform: rotate(180deg);
}
</style>

<style>
.view-toggle-menu {
  margin: 0;
  padding: 4px;
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(15, 23, 42, 0.18));
  z-index: 1000;
  max-height: 60vh;
  overflow-y: auto;
  list-style: none;
}

.view-toggle-menu li {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.view-toggle-menu li:hover:not(.active) {
  background: var(--color-primary-soft);
  color: var(--color-text);
}

.view-toggle-menu li.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: var(--color-text-inverse);
}
</style>
