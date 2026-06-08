<script setup lang="ts">
import { ref, watch } from 'vue'

export interface FlagsPreset {
  flags: string
  description: string
}

export interface DocLink {
  label: string
  url: string
}

const props = defineProps<{
  title: string
  value: string
  presets: FlagsPreset[]
  docs: DocLink[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [value: string]
  close: []
}>()

const draft = ref(props.value === '-none-' ? '' : props.value)

watch(() => props.value, (v) => {
  draft.value = v === '-none-' ? '' : v
})

function applyPreset(flags: string) {
  draft.value = flags
}

function confirm() {
  emit('update', draft.value.trim() || '-none-')
  emit('close')
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) confirm()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') confirm()
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown="onBackdropClick" @keydown="onKeydown">
      <div class="modal-box" role="dialog" :aria-label="title">
        <div class="modal-header">
          <span class="modal-title">{{ title }}</span>
          <div class="modal-docs">
            <a
              v-for="doc in docs"
              :key="doc.url"
              :href="doc.url"
              target="_blank"
              rel="noopener noreferrer"
              class="doc-link"
            >{{ doc.label }} ↗</a>
          </div>
          <button class="modal-close" @click="confirm">✕</button>
        </div>

        <textarea
          class="flags-textarea"
          :value="draft"
          :disabled="disabled"
          spellcheck="false"
          @input="draft = ($event.target as HTMLTextAreaElement).value"
        />

        <div class="presets-label">Presets</div>
        <div class="presets-list">
          <button
            v-for="preset in presets"
            :key="preset.flags"
            class="preset-row"
            :class="{ active: draft === preset.flags }"
            :disabled="disabled"
            @click="applyPreset(preset.flags)"
          >
            <code class="preset-flags">{{ preset.flags }}</code>
            <span class="preset-desc">{{ preset.description }}</span>
          </button>
        </div>

        <div class="modal-footer">
          <button class="clear-btn" :disabled="disabled" @click="draft = ''">clear</button>
          <button class="confirm-btn" @click="confirm">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  width: 560px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.modal-title {
  font-size: 11px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
}

.modal-docs {
  display: flex;
  gap: 8px;
}

.doc-link {
  font-size: 10px;
  color: #36ABFF;
  text-decoration: none;
  padding: 2px 6px;
  border: 1px solid #36ABFF44;
  border-radius: 4px;
}

.doc-link:hover {
  background: #36ABFF22;
}

.modal-close {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  line-height: 1;
}

.modal-close:hover { color: #aaa; }

.flags-textarea {
  margin: 12px 14px 8px;
  padding: 8px 10px;
  background: #0d0d0d;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  min-height: 60px;
  max-height: 120px;
  outline: none;
  flex-shrink: 0;
}

.flags-textarea:focus { border-color: #666; }
.flags-textarea:disabled { color: #555; cursor: not-allowed; }

.presets-label {
  font-size: 9px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 14px 4px;
  flex-shrink: 0;
}

.presets-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scrollbar-width: thin;
  scrollbar-color: #444 transparent;
}

.preset-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.preset-row:hover { background: #2a2a2a; border-color: #444; }
.preset-row.active { background: #1a2a1a; border-color: #555; }
.preset-row:disabled { opacity: 0.4; cursor: not-allowed; }

.preset-flags {
  font-family: monospace;
  font-size: 11px;
  color: #F0DE01;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 160px;
}

.preset-desc {
  font-size: 11px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 14px 12px;
  border-top: 1px solid #333;
  flex-shrink: 0;
}

.clear-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid #555;
  background: none;
  color: #888;
  cursor: pointer;
  font-size: 11px;
}

.clear-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.confirm-btn {
  padding: 4px 16px;
  border-radius: 4px;
  border: 1px solid #1D9E75;
  background: #1D9E75;
  color: white;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.confirm-btn:hover { background: #22b585; }
</style>
