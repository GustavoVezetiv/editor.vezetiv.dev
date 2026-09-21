import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/join')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('link com códigos preenchidos não entra automaticamente', async ({ page }) => {
  await page.goto('/join?class=DEMO&code=ANA01')
  await expect(page.getByRole('heading', { name: 'Entrar como aluno' })).toBeVisible()
  await expect(page).toHaveURL(/\/join/)
})

test('aluno entra com acesso individual e não vê painel docente', async ({ page }) => {
  await page.getByLabel('Código de acesso individual').fill('ANA01')
  await page.getByRole('button', { name: 'Entrar como aluno' }).click()
  await expect(page.getByText('Olá, Ana Souza')).toBeVisible()
  await expect(page.getByText('Painel docente')).toHaveCount(0)
  await page.goto('/teacher')
  await expect(page).toHaveURL(/\/student$/)
})

test('professor demo acessa painel e pode sair', async ({ page }) => {
  await page.getByRole('button', { name: 'Ver demonstração do professor' }).click()
  await expect(page.getByRole('heading', { name: 'Acompanhamento de aprendizagem' })).toBeVisible()
  await expect(page.getByLabel('Turma')).toHaveValue('class-demo')
  await page.goto('/student')
  await expect(page).toHaveURL(/\/teacher$/)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar como aluno' })).toBeVisible()
})
