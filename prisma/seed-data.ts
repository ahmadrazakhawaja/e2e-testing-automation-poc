// Single source of truth for seeded data — imported by the seed script and the e2e tests.
export const demoUser = {
  name: 'Demo User',
  email: 'demo@example.com',
  password: 'Password123!',
}

export const demoTasks = [
  { title: 'Set up Playwright', done: true },
  { title: 'Write login e2e tests', done: true },
  { title: 'Wire tests into CI', done: false },
  { title: 'Demo the POC to the team', done: false },
]
