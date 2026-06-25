<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '../lib/useI18n.js';

const { locale, t, availableLocales, changeLocale } = useI18n();
const open = ref(false);

const labelFor = (code) => t(`language.${code}`);

const currentLabel = computed(() => labelFor(locale.value));

const toggle = () => {
  open.value = !open.value;
};

const close = () => {
  open.value = false;
};

const pick = (code) => {
  changeLocale(code);
  close();
};

const localeFlag = {
  en: 'EN',
  pt: 'PT',
  es: 'ES',
};
</script>

<template>
  <div class="lang-switcher" :class="{ open }">
    <button
      type="button"
      class="lang-trigger"
      :aria-expanded="open"
      :aria-label="t('language.label')"
      :title="t('language.label')"
      @click="toggle"
    >
      <span class="lang-trigger-flag">{{ localeFlag[locale] || locale.toUpperCase() }}</span>
      <span class="lang-trigger-label">{{ currentLabel }}</span>
      <span class="lang-trigger-caret" aria-hidden="true">▾</span>
    </button>
    <transition name="lang-menu">
      <div v-if="open" class="lang-menu">
        <ul class="lang-menu-inner" role="menu">
          <li
            v-for="code in availableLocales"
            :key="code"
            role="none"
          >
            <button
              type="button"
              class="lang-option"
              :class="{ active: code === locale }"
              role="menuitem"
              @click="pick(code)"
            >
              <span class="lang-option-flag">{{ localeFlag[code] || code.toUpperCase() }}</span>
              <!-- <span v-if="code === locale" class="lang-option-check" aria-hidden="true">✓</span> -->
            </button>
          </li>
        </ul>
      </div>
    </transition>
    <transition name="lang-fade">
      <div v-if="open" class="lang-scrim" @click="close" aria-hidden="true"></div>
    </transition>
  </div>
</template>

<style scoped>
.lang-switcher {
  position: relative;
  z-index: 100;
}

.lang-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring),
    box-shadow var(--dur-base) var(--ease-out);
  box-shadow: var(--shadow-sm);
}

.lang-trigger:hover {
  background: var(--color-surface-strong);
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.lang-switcher.open .lang-trigger {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.lang-trigger-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-inverse);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  box-shadow: 0 2px 8px var(--color-primary-glow);
}

.lang-trigger-label {
  white-space: nowrap;
}

.lang-trigger-caret {
  font-size: 10px;
  color: var(--color-text-muted);
  transition: transform var(--dur-base) var(--ease-spring);
}

.lang-switcher.open .lang-trigger-caret {
  transform: rotate(180deg);
}

.lang-scrim {
  position: fixed;
  inset: 0;
  z-index: -1;
}

.lang-menu {
  position: absolute;
  top: 50%;
  right: calc(100% + 6px);
  transform: translateY(-50%);
  z-index: 101;
}

.lang-menu-inner {
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  gap: 10px;
  transform-origin: center right;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  color: var(--color-text);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.lang-option:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}

.lang-option.active {
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-accent-soft) 100%);
  color: var(--color-primary-strong);
  font-weight: 600;
}

.lang-option-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-inverse);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  flex-shrink: 0;
}

.lang-option-label {
  flex: 1;
}

.lang-option-check {
  color: var(--color-primary-strong);
  font-weight: 800;
}

.lang-menu-enter-active,
.lang-menu-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-spring);
}

.lang-menu-enter-from,
.lang-menu-leave-to {
  opacity: 0;
  transform: scale(0.92) translateX(-6px);
}

.lang-fade-enter-active,
.lang-fade-leave-active {
  transition: opacity var(--dur-base) var(--ease-out);
}

.lang-fade-enter-from,
.lang-fade-leave-to {
  opacity: 0;
}
</style>