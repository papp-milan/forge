import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { AuditEvent, Decision, Employee, Feature, Project, Task } from '../types/forge'

export function useForgeData() {
  const [projects, setProjects] = useState<Project[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const results = await Promise.allSettled([
      api<Project[]>('/api/projects'),
      api<Decision[]>('/api/agent-decisions'),
      api<Task[]>('/api/tasks'),
      api<Feature[]>('/api/features'),
      api<Employee[]>('/api/employees'),
      api<AuditEvent[]>('/api/audit?limit=100'),
    ])
    const [projectResult, decisionResult, taskResult, featureResult, employeeResult, auditResult] = results
    if (results.some((result) => result.status === 'rejected')) setError('Some Forge services are unavailable.')
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value)
    if (decisionResult.status === 'fulfilled') setDecisions(decisionResult.value)
    if (taskResult.status === 'fulfilled') setTasks(taskResult.value)
    if (featureResult.status === 'fulfilled') setFeatures(featureResult.value)
    if (employeeResult.status === 'fulfilled') setEmployees(employeeResult.value)
    if (auditResult.status === 'fulfilled') setAuditEvents(auditResult.value)
    setLoading(false)
  }, [])

  useEffect(() => {
    // Initial synchronization intentionally hydrates several independent slices.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const refresh = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const interval = window.setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const pending = useMemo(() => decisions.filter((decision) => decision.status === 'PENDING'), [decisions])
  return { projects, decisions, tasks, features, employees, auditEvents, loading, error, setError, load, pending }
}
