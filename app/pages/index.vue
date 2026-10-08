<script setup lang="ts">
definePageMeta({ middleware: ['auth', () => navigateTo('/dashboard')], layout: false })
</script>

<template>
  <div />
</template>
