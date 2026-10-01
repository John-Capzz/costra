import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Phase 5.6 responsive and accessibility contracts', () => {
  test('mobile navigation exposes dialog semantics and Escape handling', () => {
    const source = read('src/components/layout/Navigation.tsx')
    expect(source).toContain('role="dialog"')
    expect(source).toContain('aria-modal="true"')
    expect(source).toContain("event.key === 'Escape'")
  })

  test('application exposes a keyboard skip link and main landmark', () => {
    const source = read('src/App.tsx')
    expect(source).toContain('Skip to main content')
    expect(source).toContain('id="main-content"')
  })

  test('dense mobile layouts collapse before expanding at larger breakpoints', () => {
    expect(read('src/pages/PlanDetail.tsx')).toContain('grid-cols-1 sm:grid-cols-3')
    expect(read('src/pages/Tasks.tsx')).toContain('grid-cols-2 sm:grid-cols-4')
  })

  test('plan and execution controls have explicit label associations', () => {
    const plan = read('src/pages/PlanNew.tsx')
    const task = read('src/pages/TaskDetail.tsx')
    expect(plan).toContain('htmlFor={id}')
    expect(plan).toContain('id="plan-max-budget"')
    expect(task).toContain('htmlFor="execution-amount"')
    expect(task).toContain('id="execution-amount"')
  })
})
