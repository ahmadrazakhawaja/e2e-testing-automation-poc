<script setup lang="ts">
const { user, logout } = useAuth()
</script>

<template>
  <div>
    <header class="topbar">
      <div class="topbar-left">
        <NuxtLink to="/dashboard" class="brand">TaskBoard</NuxtLink>
        <nav class="nav" aria-label="Main">
          <NuxtLink to="/dashboard">Dashboard</NuxtLink>
          <NuxtLink to="/tasks">Tasks</NuxtLink>
        </nav>
      </div>
      <div class="topbar-right">
        <span data-testid="current-user">{{ user?.email }}</span>
        <button class="btn" @click="logout">Log out</button>
      </div>
    </header>

    <main class="container">
      <slot />
    </main>
  </div>
</template>
