import { expect, test } from '../fixtures'

test.describe('Tasks page', () => {
  test('shows empty state when no tasks exist', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
    await expect(page.getByTestId('tasks-empty')).toHaveText(
      'No tasks yet. Add your first one above.',
    )
    await expect(page.getByTestId('tasks-summary')).toHaveText('0 of 0 completed')
  })

  test('creates a task and shows it in the list', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByLabel('Task title').fill('Buy groceries')
    await page.getByRole('button', { name: 'Add task' }).click()

    await expect(page.getByTestId('tasks-empty')).toBeHidden()
    await expect(page.getByTestId('tasks-list')).toContainText('Buy groceries')
    await expect(page.getByTestId('tasks-summary')).toHaveText('0 of 1 completed')
  })

  test('shows error when title is empty', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByRole('button', { name: 'Add task' }).click()

    await expect(page.getByRole('alert')).toHaveText('Please enter a task title.')
  })

  test('shows error when title exceeds 120 characters', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByLabel('Task title').fill('a'.repeat(121))
    await page.getByRole('button', { name: 'Add task' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Task title must be 120 characters or fewer.',
    )
  })

  test('toggles task completion via checkbox', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByLabel('Task title').fill('Read documentation')
    await page.getByRole('button', { name: 'Add task' }).click()

    await page.getByRole('checkbox', { name: 'Read documentation' }).click()

    await expect(page.getByTestId('tasks-summary')).toHaveText('1 of 1 completed')
  })

  test('unchecks a completed task', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByLabel('Task title').fill('Fix bug #42')
    await page.getByRole('button', { name: 'Add task' }).click()

    await page.getByRole('checkbox', { name: 'Fix bug #42' }).click()
    await expect(page.getByTestId('tasks-summary')).toHaveText('1 of 1 completed')

    await page.getByRole('checkbox', { name: 'Fix bug #42' }).click()
    await expect(page.getByTestId('tasks-summary')).toHaveText('0 of 1 completed')
  })

  test('deletes a task', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByLabel('Task title').fill('Temporary task')
    await page.getByRole('button', { name: 'Add task' }).click()

    await page.getByRole('button', { name: 'Delete task: Temporary task' }).click()

    await expect(page.getByTestId('tasks-list')).not.toBeVisible()
    await expect(page.getByTestId('tasks-empty')).toBeVisible()
    await expect(page.getByTestId('tasks-summary')).toHaveText('0 of 0 completed')
  })

  test('clears form after successful task creation', async ({ page, signedInUser }) => {
    await page.goto('/tasks')

    await page.getByLabel('Task title').fill('First task')
    await page.getByRole('button', { name: 'Add task' }).click()

    await expect(page.getByLabel('Task title')).toHaveValue('')
  })
})
