export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchUser } = useAuth()
  if (!user.value) await fetchUser()

  if (user.value) return navigateTo('/dashboard')
})
