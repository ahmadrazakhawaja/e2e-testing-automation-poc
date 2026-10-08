# E2E test conventions

Read by humans and by the e2e agent (`tools/e2e-agent`). Keep it short and true.

## Imports

Always import `test` and `expect` from the local fixtures, never from `@playwright/test` directly:

```ts
import { expect, test } from '../fixtures' // from tests/e2e/generated/
```

## Users and data

- **Anything that creates, changes or deletes data uses `signedInUser`.** It is a fresh user with no
  tasks, created for this test only and deleted afterwards, already signed in on `page`.
- `testUser` is the same fresh user but *not* signed in (for login-flow tests).
- The seeded demo user (`authenticated` fixture, `prisma/seed-data.ts`) is shared by every test running
  in parallel. Only read from it; never create, toggle or delete its data.
- Tests run in parallel and in any order. Never depend on another test's data.

```ts
test('adds a task', async ({ page, signedInUser }) => {
  await page.goto('/tasks')
  // ...signedInUser starts with zero tasks
})
```

## Locators

Prefer, in order: `getByRole` (with `name`) → `getByLabel` → `getByText` → `getByTestId`.
No CSS/XPath selectors, no `nth()` unless order is the thing being tested.

## Waiting

Use web-first assertions (`await expect(locator).toHaveText(...)`, `toHaveURL`, `toHaveCount`).
Never `page.waitForTimeout`. Form controls are disabled until the page hydrates; `fill`/`click`
already wait for that.

## Page objects

Reuse `tests/e2e/pages/*` when one exists for the page. Inline locators are fine for a page that
has no page object yet.

## Scope of a spec

One spec file per page or feature. Each test checks one behaviour, with a name that reads as a
sentence: `test('shows an error when the title is empty', ...)`.
