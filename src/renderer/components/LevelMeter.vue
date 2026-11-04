<script setup lang="ts">
import { computed } from 'vue'
import { parseLevels, levelToFraction, formatDb } from '../utils/levels'

// Classic loudness bars, one column per audio channel. Fill = RMS, tick = peak,
// both on a -60..0 dBFS scale. Hovering a column shows the exact values.
const props = defineProps<{
  tx: string
  rx: string
}>()

const groups = computed(() =>
  [
    { key: 'tx', label: 'TX', channels: parseLevels(props.tx) },
    { key: 'rx', label: 'RX', channels: parseLevels(props.rx) }
  ].filter((g) => g.channels.length > 0)
)

function tooltip(label: string, ch: number, rms: number, peak: number | null): string {
  const peakText = peak === null ? '' : `, peak ${formatDb(peak)} dBFS`
  return `${label} channel ${ch + 1}: RMS ${formatDb(rms)} dBFS${peakText}`
}
</script>

<template>
  <div v-if="groups.length" class="level-meter" data-testid="level-meter">
    <div v-for="g in groups" :key="g.key" class="group">
      <span class="group-label">{{ g.label }}</span>
      <div class="bars">
        <div
          v-for="(c, i) in g.channels"
          :key="i"
          class="bar"
          :title="tooltip(g.label, i, c.rms, c.peak)"
          :data-testid="`${g.key}-bar-${i}`"
        >
          <div class="fill" :style="{ height: levelToFraction(c.rms) * 100 + '%' }" />
          <div
            v-if="c.peak !== null"
            class="peak"
            :style="{ bottom: levelToFraction(c.peak) * 100 + '%' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.level-meter { display: flex; gap: 16px; margin-bottom: 12px; }
.group { display: flex; align-items: flex-end; gap: 6px; flex: 1; min-width: 0; }
.group-label { font-size: 10px; color: #888; line-height: 1; }
.bars { display: flex; gap: 2px; flex: 1; min-width: 0; }
.bar {
  position: relative; flex: 1; min-width: 4px; max-width: 24px; height: 40px;
  background: #1a1a1a; border: 1px solid #333; border-radius: 2px; overflow: hidden;
}
.fill {
  position: absolute; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to top, #1D9E75 0, #1D9E75 70%, #e0b030 85%, #d94040 100%);
  background-size: 100% 40px; background-position: bottom;
}
.peak { position: absolute; left: 0; right: 0; height: 2px; background: #eee; transform: translateY(1px); }
</style>
