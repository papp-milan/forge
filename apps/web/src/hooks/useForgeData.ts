import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { AuditEvent, Decision, Employee, Feature, Idea, Pitch, Project, Task } from '../types/forge'

const DYNAMIC_REFRESH_MS = 10_000
const STATIC_REFRESH_MS = 60_000

export function useForgeData() {
  const [projects, setProjects] = useState<Project[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dynamicLoadingRef = useRef(false)
  const staticLoadingRef = useRef(false)
  const activeLoadsRef = useRef(0)

  const setLoadState = (active: boolean) => {
    activeLoadsRef.current += active ? 1 : -1
    setLoading(activeLoadsRef.current > 0)
  }

  const loadDynamic = useCallback(async () => {
    if (dynamicLoadingRef.current) return
    dynamicLoadingRef.current = true
    setLoadState(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        api<Decision[]>('/api/agent-decisions'),
        api<Task[]>('/api/tasks'),
        api<Feature[]>('/api/features'),
        api<Pitch[]>('/api/pitches'),
        api<Idea[]>('/api/ideas'),
      ])
      const [decisionResult, taskResult, featureResult, pitchResult, ideaResult] = results
      if (results.some((result) => result.status === 'rejected')) setError('Some Forge services are unavailable.')
      if (decisionResult.status === 'fulfilled') setDecisions(decisionResult.value)
      if (taskResult.status === 'fulfilled') setTasks(taskResult.value)
      if (featureResult.status === 'fulfilled') setFeatures(featureResult.value)
      if (pitchResult.status === 'fulfilled') setPitches(pitchResult.value)
      if (ideaResult.status === 'fulfilled') setIdeas(ideaResult.value)
    } finally {
      dynamicLoadingRef.current = false
      setLoadState(false)
    }
  }, [])

  const loadStatic = useCallback(async () => {
    if (staticLoadingRef.current) return
    staticLoadingRef.current = true
    setLoadState(true)
    try {
      const results = await Promise.allSettled([
        api<Project[]>('/api/projects'),
        api<Employee[]>('/api/employees'),
        api<AuditEvent[]>('/api/audit?limit=100'),
      ])
      const [projectResult, employeeResult, auditResult] = results
      if (results.some((result) => result.status === 'rejected')) setError('Some Forge services are unavailable.')
      if (projectResult.status === 'fulfilled') setProjects(projectResult.value)
      if (employeeResult.status === 'fulfilled') setEmployees(employeeResult.value)
      if (auditResult.status === 'fulfilled') setAuditEvents(auditResult.value)
    } finally {
      staticLoadingRef.current = false
      setLoadState(false)
    }
  }, [])

  const load = useCallback(async () => {
    await Promise.all([loadStatic(), loadDynamic()])
  }, [loadDynamic, loadStatic])

  useEffect(() => {
    // Initial synchronization intentionally hydrates several independent slices.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const refreshDynamic = () => {
      if (document.visibilityState === 'visible') void loadDynamic()
    }
    const refreshStatic = () => {
      if (document.visibilityState === 'visible') void loadStatic()
    }
    const dynamicInterval = window.setInterval(refreshDynamic, DYNAMIC_REFRESH_MS)
    const staticInterval = window.setInterval(refreshStatic, STATIC_REFRESH_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(dynamicInterval)
      window.clearInterval(staticInterval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [load, loadDynamic, loadStatic])

  const pending = useMemo(() => decisions.filter((decision) => decision.status === 'PENDING'), [decisions])
  const pendingPitches = useMemo(() => pitches.filter((pitch) => pitch.status === 'PENDING_APPROVAL'), [pitches])
  return { projects, decisions, tasks, features, pitches, ideas, employees, auditEvents, loading, error, setError, load, pending, pendingPitches }
}
