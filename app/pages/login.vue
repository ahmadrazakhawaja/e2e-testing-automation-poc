<script setup lang="ts">
definePageMeta({ middleware: 'guest' })
useHead({ title: 'Sign in · TaskBoard' })

const { login } = useAuth()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
// Keep the form disabled until hydration: before then, typed values never reach v-model
// and a click would trigger a native (GET) form submit.
const hydrated = ref(false)
onMounted(() => (hydrated.value = true))

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function redirectTarget() {
  const target = route.query.redirect
  // Only allow same-origin relative paths to avoid open redirects.
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/dashboard'
}

async function onSubmit() {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }
  if (!EMAIL_PATTERN.test(email.value)) {
    error.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    await login(email.value, password.value)
    await navigateTo(redirectTarget())
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <form class="card auth-card" novalidate data-testid="login-form" @submit.prevent="onSubmit">
      <div class="brand">TaskBoard</div>
      <h1>Sign in</h1>
      <p class="muted">Use your account to access the dashboard.</p>

      <fieldset :disabled="!hydrated || loading">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="username" placeholder="you@example.com">

        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password">

        <p v-if="error" class="alert" role="alert">{{ error }}</p>

        <button type="submit" class="btn btn-primary">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </fieldset>
    </form>
  </main>
</template>
