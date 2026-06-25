import { computed, onBeforeUnmount, ref } from 'vue';
import {
  getAvailableLocales,
  getLocale,
  onLocaleChange,
  setLocale,
  translate,
} from './i18n.js';

export const useI18n = () => {
  const locale = ref(getLocale());

  const stop = onLocaleChange((next) => {
    locale.value = next;
  });

  onBeforeUnmount(() => {
    stop();
  });

  // `t` reads `locale.value` so the dependency tracker picks up locale changes
  // and the template re-renders. Calling t('…') in a computed/template also
  // caches per-locale since `translate` reads the current locale at call time.
  const t = (key, params, fallback) => {
    void locale.value;
    return translate(key, params, fallback);
  };

  const availableLocales = computed(() => getAvailableLocales());

  const changeLocale = (next) => setLocale(next);

  return {
    locale,
    t,
    availableLocales,
    changeLocale,
  };
};