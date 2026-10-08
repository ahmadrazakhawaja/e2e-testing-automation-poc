<script setup lang="ts">
import type { TaskItem } from '~~/shared/types/auth'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Dashboard · TaskBoard' })

const { user } = useAuth()
const { data: tasks } = await useFetch<TaskItem[]>('/api/tasks', { default: () => [] })

const completed = computed(() => tasks.value.filter((t) => t.done).length)

function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}
</script>

<template>
  <div>
    <h1>Welcome back, {{ user?.name }}</h1>

    <div class="grid">
      <section class="card" aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <dl>
          <dt>Name</dt>
          <dd>{{ user?.name }}</dd>
          <dt>Email</dt>
          <dd>{{ user?.email }}</dd>
          <dt>Last sign-in</dt>
          <dd>{{ formatDate(user?.lastLoginAt) }}</dd>
        </dl>
      </section>

      <section class="card" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading">Your tasks</h2>
        <p class="muted" data-testid="task-progress">{{ completed }} of {{ tasks.length }} completed</p>
        <ul class="tasks" data-testid="task-list">
          <li v-for="task in tasks" :key="task.id" :class="{ done: task.done }">
            <span class="check" aria-hidden="true">{{ task.done ? '✓' : '' }}</span>
            <span class="task-title">{{ task.title }}</span>
          </li>
        </ul>
        <NuxtLink to="/tasks" class="card-link">Manage tasks →</NuxtLink>
      </section>
    </div>
  </div>
</template>
