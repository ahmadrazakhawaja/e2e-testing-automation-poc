<script setup lang="ts">
import type { TaskItem } from '~~/shared/types/auth'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Tasks · TaskBoard' })

const TITLE_MAX = 120

const hydrated = useHydrated()
const { data: tasks } = await useFetch<TaskItem[]>('/api/tasks', { default: () => [] })

const newTitle = ref('')
const formError = ref('')
const listError = ref('')
const creating = ref(false)
const pendingIds = ref(new Set<string>())

const completed = computed(() => tasks.value.filter((t) => t.done).length)

function errorMessage(e: any, fallback: string) {
  return e?.data?.statusMessage ?? e?.statusMessage ?? fallback
}

async function createTask() {
  formError.value = ''
  const title = newTitle.value.trim()

  if (!title) {
    formError.value = 'Please enter a task title.'
    return
  }
  if (title.length > TITLE_MAX) {
    formError.value = `Task title must be ${TITLE_MAX} characters or fewer.`
    return
  }

  creating.value = true
  try {
    const task = await $fetch<TaskItem>('/api/tasks', { method: 'POST', body: { title } })
    tasks.value = [...tasks.value, task]
    newTitle.value = ''
  } catch (e) {
    formError.value = errorMessage(e, 'Could not create the task. Please try again.')
  } finally {
    creating.value = false
  }
}

async function withPending(id: string, action: () => Promise<void>) {
  listError.value = ''
  pendingIds.value.add(id)
  try {
    await action()
  } finally {
    pendingIds.value.delete(id)
  }
}

// useFetch data is a shallow ref in Nuxt 4, so replace items instead of mutating them.
function setDone(id: string, done: boolean) {
  tasks.value = tasks.value.map((t) => (t.id === id ? { ...t, done } : t))
}

function toggleTask(task: TaskItem) {
  return withPending(task.id, async () => {
    const done = !task.done
    setDone(task.id, done) // optimistic
    try {
      await $fetch(`/api/tasks/${task.id}`, { method: 'PATCH', body: { done } })
    } catch (e) {
      setDone(task.id, !done)
      listError.value = errorMessage(e, 'Could not update the task.')
    }
  })
}

function deleteTask(task: TaskItem) {
  return withPending(task.id, async () => {
    try {
      await $fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      tasks.value = tasks.value.filter((t) => t.id !== task.id)
    } catch (e) {
      listError.value = errorMessage(e, 'Could not delete the task.')
    }
  })
}
</script>

<template>
  <div>
    <h1>Tasks</h1>
    <p class="muted" data-testid="tasks-summary">{{ completed }} of {{ tasks.length }} completed</p>

    <div class="stack">
      <section class="card" aria-labelledby="new-task-heading">
        <h2 id="new-task-heading">New task</h2>
        <form novalidate data-testid="new-task-form" @submit.prevent="createTask">
          <fieldset class="inline-form" :disabled="!hydrated || creating">
            <label for="new-task-title" class="sr-only">Task title</label>
            <input
              id="new-task-title"
              v-model="newTitle"
              type="text"
              placeholder="What needs to be done?"
              autocomplete="off"
            >
            <button type="submit" class="btn btn-accent">{{ creating ? 'Adding…' : 'Add task' }}</button>
          </fieldset>
          <p v-if="formError" class="alert" role="alert">{{ formError }}</p>
        </form>
      </section>

      <section class="card" aria-labelledby="all-tasks-heading">
        <h2 id="all-tasks-heading">All tasks</h2>
        <p v-if="listError" class="alert" role="alert">{{ listError }}</p>

        <p v-if="tasks.length === 0" class="muted" data-testid="tasks-empty">No tasks yet. Add your first one above.</p>

        <ul v-else class="tasks" data-testid="tasks-list">
          <li v-for="task in tasks" :key="task.id" :class="{ done: task.done }">
            <input
              :id="`task-${task.id}`"
              type="checkbox"
              :checked="task.done"
              :disabled="!hydrated || pendingIds.has(task.id)"
              @change="toggleTask(task)"
            >
            <label :for="`task-${task.id}`" class="task-title">{{ task.title }}</label>
            <button
              type="button"
              class="btn btn-ghost"
              :aria-label="`Delete task: ${task.title}`"
              :disabled="!hydrated || pendingIds.has(task.id)"
              @click="deleteTask(task)"
            >
              Delete
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
