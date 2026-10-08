export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  // Lets the e2e build use its own build dir so it doesn't clobber a running `nuxt dev`.
  ...(process.env.NUXT_BUILD_DIR && { buildDir: process.env.NUXT_BUILD_DIR }),
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'TaskBoard',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
