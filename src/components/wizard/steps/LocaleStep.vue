<script setup>
/**
 * LocaleStep.vue — Wizard Step 5
 *
 * Set timezone and language preferences.
 */

const props = defineProps({
  modelValue: { type: Object, required: true },
  timezones: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">Set your timezone and language preferences.</p>

    <div class="space-y-4">
      <div>
        <label for="locale-timezone" class="block text-sm font-medium text-theme-primary mb-1.5">Timezone</label>
        <select
          id="locale-timezone"
          :value="modelValue.timezone"
          @change="update('timezone', $event.target.value)"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
        >
          <option value="UTC">UTC (Coordinated Universal)</option>
          <optgroup v-for="region in ['Americas', 'Europe', 'Asia', 'Pacific', 'Africa']" :key="region" :label="region">
            <option
              v-for="tz in timezones.filter(t => t.region === region)"
              :key="tz.id"
              :value="tz.id"
            >
              {{ tz.name }} ({{ tz.offset }})
            </option>
          </optgroup>
        </select>
      </div>

      <div>
        <label for="locale-language" class="block text-sm font-medium text-theme-primary mb-1.5">Language</label>
        <select
          id="locale-language"
          :value="modelValue.language"
          @change="update('language', $event.target.value)"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
        >
          <option value="en">English</option>
          <option value="es">Espanol</option>
          <option value="de">Deutsch</option>
          <option value="fr">Francais</option>
          <option value="nl">Nederlands</option>
          <option value="pt">Portugues</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
        </select>
      </div>
    </div>
  </div>
</template>
