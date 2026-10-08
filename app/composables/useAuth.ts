import type { PublicUser } from '~~/shared/types/auth'

export function useAuth() {
  const user = useState<PublicUser | null>('auth-user', () => null)
  // Forwards the browser's cookies when this runs during SSR.
  const requestFetch = useRequestFetch()

  async function fetchUser() {
    const res = await requestFetch<{ user: PublicUser | null }>('/api/auth/me')
    user.value = res.user
  }

  async function login(email: string, password: string) {
    const res = await $fetch<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, fetchUser, login, logout }
}
