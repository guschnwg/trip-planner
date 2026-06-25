<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { addTrip, removeTrip, setActiveTripId, trips, updateTrip } from '../stores/trips.js';
import { useI18n } from '../lib/useI18n.js';

const { t } = useI18n();

const props = defineProps({
  open: { type: Boolean, default: true },
  canClose: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'selected']);

const mode = ref(trips.value.length ? 'select' : 'create');
const editingId = ref(null);

const form = reactive({
  name: '',
  startDate: '',
  endDate: '',
});

const error = ref('');

const pad2 = (n) => String(n).padStart(2, '0');

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const defaultStartEnd = (baseDate) => {
  const start = new Date(`${baseDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  return [
    `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  ];
};

const resetForm = () => {
  const [s, e] = defaultStartEnd(todayISO());
  form.name = '';
  form.startDate = s;
  form.endDate = e;
  editingId.value = null;
};

onMounted(() => {
  if (!form.startDate) resetForm();
});

watch(
  () => mode.value,
  (m) => {
    if (m === 'create') resetForm();
    error.value = '';
  },
);

const startCreate = () => {
  mode.value = 'create';
};

const startEdit = (trip) => {
  mode.value = 'create';
  editingId.value = trip.id;
  form.name = trip.name;
  form.startDate = trip.startDate;
  form.endDate = trip.endDate;
  error.value = '';
};

const selectTrip = (trip) => {
  setActiveTripId(trip.id);
  emit('selected', trip);
};

const handleCreateOrSave = () => {
  error.value = '';
  if (!form.name.trim()) {
    error.value = t('tripModal.errors.nameRequired');
    return;
  }
  if (!form.startDate || !form.endDate) {
    error.value = t('tripModal.errors.datesRequired');
    return;
  }
  if (form.endDate < form.startDate) {
    error.value = t('tripModal.errors.endBeforeStart');
    return;
  }
  if (editingId.value) {
    const updated = updateTrip(editingId.value, {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    if (updated) selectTrip(updated);
  } else {
    const created = addTrip({
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    selectTrip(created);
  }
};

const handleDelete = (trip) => {
  const msg = t('tripModal.deleteConfirm', { name: trip.name });
  if (!confirm(msg)) return;
  removeTrip(trip.id);
  if (mode.value === 'create' && editingId.value === trip.id) {
    resetForm();
  }
};

const isValid = computed(
  () =>
    form.name.trim() &&
    form.startDate &&
    form.endDate &&
    form.endDate >= form.startDate,
);

const formatRange = (trip) => {
  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };
  const sep = t('tripModal.rangeSeparator');
  return `${fmt(trip.startDate)} ${sep} ${fmt(trip.endDate)}`;
};

const modalTitle = computed(() => {
  if (mode.value === 'create') {
    return editingId.value ? t('tripModal.titleEdit') : t('tripModal.titleCreate');
  }
  return t('tripModal.titleSelect');
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-backdrop">
      <div v-if="open" class="trip-modal-backdrop">
        <Transition name="modal-card" appear>
          <div class="trip-modal" role="dialog" aria-modal="true" :aria-labelledby="`trip-modal-title-${mode}`">
            <div class="trip-modal-glow" aria-hidden="true"></div>
            <header class="trip-modal-header">
              <h2 :id="`trip-modal-title-${mode}`">{{ modalTitle }}</h2>
              <button
                v-if="canClose"
                class="close-btn"
                type="button"
                @click="$emit('close')"
                :aria-label="t('tripModal.actions.close')"
              >
                &times;
              </button>
            </header>

            <div class="trip-modal-body">
              <div v-if="mode === 'select'" key="select">
                <p v-if="!trips.length" class="empty">{{ t('tripModal.empty') }}</p>
                <ul v-else class="trip-list">
                  <li v-for="trip in trips" :key="trip.id" class="trip-item">
                    <button class="trip-select" type="button" @click="selectTrip(trip)">
                      <span class="trip-name">{{ trip.name }}</span>
                      <span class="trip-range">{{ formatRange(trip) }}</span>
                    </button>
                    <div class="trip-actions">
                      <button class="icon-btn" type="button" @click="startEdit(trip)" :aria-label="t('tripModal.actions.edit')">
                        {{ t('tripModal.actions.edit') }}
                      </button>
                      <button class="icon-btn danger" type="button" @click="handleDelete(trip)" :aria-label="t('tripModal.actions.delete')">
                        {{ t('tripModal.actions.delete') }}
                      </button>
                    </div>
                  </li>
                </ul>
                <div class="trip-modal-footer">
                  <button class="tp-btn tp-btn-primary" type="button" @click="startCreate">
                    {{ t('tripModal.actions.newTrip') }}
                  </button>
                </div>
              </div>

              <form v-else class="trip-form" @submit.prevent="handleCreateOrSave" key="create">
                <label class="field">
                  <span class="field-label">{{ t('tripModal.fields.name') }}</span>
                  <input
                    class="tp-input"
                    type="text"
                    v-model="form.name"
                    :placeholder="t('tripModal.namePlaceholder')"
                    maxlength="80"
                    autofocus
                  />
                </label>
                <div class="row">
                  <label class="field">
                    <span class="field-label">{{ t('tripModal.fields.startDate') }}</span>
                    <input class="tp-input" type="date" v-model="form.startDate" :max="form.endDate || undefined" />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('tripModal.fields.endDate') }}</span>
                    <input class="tp-input" type="date" v-model="form.endDate" :min="form.startDate || undefined" />
                  </label>
                </div>

                <Transition name="error-fade">
                  <p v-if="error" class="error">{{ error }}</p>
                </Transition>

                <div class="trip-modal-footer">
                  <button
                    v-if="trips.length"
                    type="button"
                    class="tp-btn tp-btn-secondary"
                    @click="mode = 'select'"
                  >
                    {{ t('tripModal.actions.cancel') }}
                  </button>
                  <button type="submit" class="tp-btn tp-btn-primary" :disabled="!isValid">
                    {{ editingId ? t('tripModal.actions.save') : t('tripModal.actions.createTrip') }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.trip-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.trip-modal {
  position: relative;
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  backdrop-filter: var(--glass-blur-strong);
  width: min(540px, 100%);
  max-height: 90vh;
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trip-modal-glow {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(99, 102, 241, 0.55) 0%,
    rgba(236, 72, 153, 0.45) 50%,
    rgba(80, 220, 255, 0.40) 100%);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
  opacity: 0.7;
  animation: tpGlowRotate 8s linear infinite;
}

@keyframes tpGlowRotate {
  to {
    filter: hue-rotate(360deg);
  }
}

.trip-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-surface-soft);
  position: relative;
}

.trip-modal-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
          background-clip: text;
  color: transparent;
}

.close-btn {
  background: transparent;
  border: 0;
  font-size: 22px;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.close-btn:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  transform: rotate(90deg);
}

.trip-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 22px;
  overflow-y: auto;
  flex: 1;
}

.empty {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 32px 0;
  font-style: italic;
}

.trip-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trip-item {
  display: flex;
  align-items: stretch;
  gap: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-strong);
  overflow: hidden;
  transition:
    transform var(--dur-base) var(--ease-spring),
    box-shadow var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);
  animation: fadeIn var(--dur-slow) var(--ease-out) both;
}

.trip-item:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary);
  box-shadow: 0 8px 20px var(--color-primary-glow);
}

.trip-select {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: transparent;
  border: 0;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  font-family: inherit;
  transition: background var(--dur-fast) var(--ease-out);
}

.trip-select:hover {
  background: var(--color-primary-soft);
}

.trip-name {
  font-weight: 700;
  font-size: 14px;
}

.trip-range {
  font-size: 12px;
  color: var(--color-text-muted);
}

.trip-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
}

.icon-btn {
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.icon-btn:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary-strong);
}

.icon-btn.danger {
  color: var(--color-danger);
  border-color: rgba(239, 68, 68, 0.30);
}

.icon-btn.danger:hover {
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
}

.trip-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: fadeIn var(--dur-slow) var(--ease-out);
}

.row {
  display: flex;
  gap: 10px;
}

.row .field {
  flex: 1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.error {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 8px 10px;
  border-radius: var(--radius-md);
}

.trip-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.modal-backdrop-enter-active,
.modal-backdrop-leave-active {
  transition: opacity var(--dur-base) var(--ease-out);
}

.modal-backdrop-enter-from,
.modal-backdrop-leave-to {
  opacity: 0;
}

.modal-card-enter-active,
.modal-card-leave-active {
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-spring);
}

.modal-card-enter-from,
.modal-card-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(20px);
}

.error-fade-enter-active,
.error-fade-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-spring);
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>