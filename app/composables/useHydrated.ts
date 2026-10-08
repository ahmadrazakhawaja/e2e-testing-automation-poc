/**
 * False during SSR and until the component mounts on the client. Use it to disable form
 * controls: before hydration, typed values never reach v-model and a click would trigger
 * a native form submit.
 */
export function useHydrated() {
  const hydrated = ref(false)
  onMounted(() => (hydrated.value = true))
  return hydrated
}
