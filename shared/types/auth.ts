export interface PublicUser {
  id: string
  name: string
  email: string
  createdAt: string
  lastLoginAt: string | null
}

export interface TaskItem {
  id: string
  title: string
  done: boolean
}
