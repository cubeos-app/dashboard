<script setup>
/**
 * AdminStep.vue — Wizard Step 2
 *
 * Create administrator account: username, email, password.
 */

const props = defineProps({
  modelValue: { type: Object, required: true },
  validation: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">Create your administrator account. This will be used to log into the dashboard.</p>

    <div class="space-y-4">
      <div>
        <label for="admin-username" class="block text-sm font-medium text-theme-primary mb-1.5">Username</label>
        <input
          id="admin-username"
          :value="modelValue.admin_username"
          @input="update('admin_username', $event.target.value)"
          type="text"
          placeholder="admin"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          :class="{ 'border-error': validation.errors?.admin_username }"
        />
        <p v-if="validation.errors?.admin_username" class="text-xs text-error mt-1">{{ validation.errors.admin_username }}</p>
        <p v-else class="text-xs text-theme-muted mt-1">Lowercase letters, numbers, underscores (3-32 chars)</p>
      </div>

      <div>
        <label for="admin-email" class="block text-sm font-medium text-theme-primary mb-1.5">Email</label>
        <input
          id="admin-email"
          :value="modelValue.admin_email"
          @input="update('admin_email', $event.target.value)"
          type="email"
          placeholder="admin@example.com"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p class="text-xs text-theme-muted mt-1">Used for notifications and some app configurations</p>
      </div>

      <div>
        <label for="admin-password" class="block text-sm font-medium text-theme-primary mb-1.5">Password</label>
        <input
          id="admin-password"
          :value="modelValue.admin_password"
          @input="update('admin_password', $event.target.value)"
          type="password"
          placeholder="Minimum 8 characters"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          :class="{ 'border-error': validation.errors?.admin_password }"
        />
        <p v-if="validation.errors?.admin_password" class="text-xs text-error mt-1">{{ validation.errors.admin_password }}</p>
        <p v-else-if="validation.warnings?.admin_password" class="text-xs text-warning mt-1">{{ validation.warnings.admin_password }}</p>
        <p v-else class="text-xs text-theme-muted mt-1">Minimum 8 characters (12+ recommended)</p>
      </div>

      <div>
        <label for="admin-password-confirm" class="block text-sm font-medium text-theme-primary mb-1.5">Confirm Password</label>
        <input
          id="admin-password-confirm"
          :value="modelValue.admin_password_confirm"
          @input="update('admin_password_confirm', $event.target.value)"
          type="password"
          placeholder="Repeat password"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          :class="{ 'border-error': modelValue.admin_password && modelValue.admin_password !== modelValue.admin_password_confirm }"
        />
        <p v-if="modelValue.admin_password && modelValue.admin_password !== modelValue.admin_password_confirm" class="text-xs text-error mt-1">
          Passwords do not match
        </p>
      </div>
    </div>
  </div>
</template>
