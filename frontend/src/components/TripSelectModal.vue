<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { addTrip, removeTrip, setActiveTripId, trips, updateTrip } from '../stores/trips.js';

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
    error.value = 'Name is required.';
    return;
  }
  if (!form.startDate || !form.endDate) {
    error.value = 'Start and end dates are required.';
    return;
  }
  if (form.endDate < form.startDate) {
    error.value = 'End date must be on or after start date.';
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
  if (!confirm(`Delete trip "${trip.name}"? Its events will remain in storage but become orphaned.`)) return;
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
  return `${fmt(trip.startDate)} → ${fmt(trip.endDate)}`;
};
</script>

<template>
  <div v-if="open" class="trip-modal-backdrop">
    <div class="trip-modal" role="dialog" aria-modal="true" aria-labelledby="trip-modal-title">
      <header class="trip-modal-header">
        <h2 id="trip-modal-title">
          {{ mode === 'create' ? (editingId ? 'Edit trip' : 'New trip') : 'Your trips' }}
        </h2>
        <button
          v-if="canClose"
          class="close-btn"
          type="button"
          @click="$emit('close')"
          aria-label="Close"
        >
          &times;
        </button>
      </header>

      <div class="trip-modal-body">
        <div v-if="mode === 'select'">
          <p v-if="!trips.length" class="empty">No trips yet. Create your first one.</p>
          <ul v-else class="trip-list">
            <li v-for="trip in trips" :key="trip.id" class="trip-item">
              <button class="trip-select" type="button" @click="selectTrip(trip)">
                <span class="trip-name">{{ trip.name }}</span>
                <span class="trip-range">{{ formatRange(trip) }}</span>
              </button>
              <div class="trip-actions">
                <button class="icon-btn" type="button" @click="startEdit(trip)" aria-label="Edit trip">
                  Edit
                </button>
                <button class="icon-btn danger" type="button" @click="handleDelete(trip)" aria-label="Delete trip">
                  Delete
                </button>
              </div>
            </li>
          </ul>
          <div class="trip-modal-footer">
            <button class="btn btn-primary" type="button" @click="startCreate">
              New trip
            </button>
          </div>
        </div>

        <form v-else class="trip-form" @submit.prevent="handleCreateOrSave">
          <label class="field">
            <span class="field-label">Name</span>
            <input
              type="text"
              v-model="form.name"
              placeholder="Tokyo 2026, Summer road trip…"
              maxlength="80"
              autofocus
            />
          </label>
          <div class="row">
            <label class="field">
              <span class="field-label">Start date</span>
              <input type="date" v-model="form.startDate" :max="form.endDate || undefined" />
            </label>
            <label class="field">
              <span class="field-label">End date</span>
              <input type="date" v-model="form.endDate" :min="form.startDate || undefined" />
            </label>
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <div class="trip-modal-footer">
            <button
              v-if="trips.length"
              type="button"
              class="btn btn-secondary"
              @click="mode = 'select'"
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!isValid">
              {{ editingId ? 'Save' : 'Create trip' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trip-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.trip-modal {
  background: #ffffff;
  width: min(520px, 100%);
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trip-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid #ececec;
}

.trip-modal-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: 0;
  font-size: 22px;
  line-height: 1;
  color: #555;
  cursor: pointer;
  padding: 0 4px;
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
  color: #666;
  text-align: center;
  padding: 20px 0;
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
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  overflow: hidden;
}

.trip-select {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: #ffffff;
  border: 0;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  color: #1a1a1a;
}

.trip-select:hover {
  background: #f5f8ff;
}

.trip-name {
  font-weight: 600;
  font-size: 14px;
}

.trip-range {
  font-size: 12px;
  color: #666;
}

.trip-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 6px;
}

.icon-btn {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  color: #333;
}

.icon-btn:hover {
  background: #f0f0f0;
}

.icon-btn.danger {
  color: #b42318;
  border-color: #fecdca;
}

.icon-btn.danger:hover {
  background: #fef3f2;
}

.trip-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  gap: 4px;
}

.field-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.field input {
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.field input:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.error {
  margin: 0;
  font-size: 12px;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  padding: 6px 8px;
  border-radius: 6px;
}

.trip-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2b7fff;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1f6fe5;
}

.btn-secondary {
  background: #ffffff;
  color: #333;
  border-color: #d4d4d4;
}

.btn-secondary:hover {
  background: #f0f0f0;
}
</style>
