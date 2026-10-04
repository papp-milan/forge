import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, AlertTriangle, GitPullRequest, Lightbulb, LayoutDashboard, Moon, Plus, RefreshCw, ShieldCheck, Sun, Users, X } from 'lucide-react'
import type { Decision, Employee, Feature, Task } from './types/forge'
import { useForgeData } from './hooks/useForgeData'
import { api } from './api/client'
import { AgentEventLogDialog, Approvals, ActivityView, DecisionDetails, Development, Employees, FeatureDetails, IdeasView, NavItem, Overview, TaskDetails } from './components/AppViews'

type View = 'overview' | 'approvals' | 'employees' | 'development' | 'ideas' | 'activity'
const VIEW_ORDER: View[] = ['overview', 'approvals', 'employees', 'development', 'ideas', 'activity']
const pathToView = (path: string): View => {
  const candidate = path.replace(/^\//, '').split('/')[0] as View
  return VIEW_ORDER.includes(candidate) ? candidate : 'overview'
}

function App() {
  const { projects, decisions, tasks, features, pitches, ideas, employees, auditEvents, loading, error, setError, load, pending, pendingPitches } = useForgeData()
  const [busyId, setBusyId] = useState<string | null>(null)
  const viewOrder = VIEW_ORDER
  const [view, setView] = useState<View>(() => pathToView(window.location.pathname))
  const [viewDirection, setViewDirection] = useState<'forward' | 'backward'>('forward')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return (window.localStorage.getItem('forge-theme') as 'light' | 'dark' | null) ?? 'light'
  })
  const [themeTransition, setThemeTransition] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectRepository, setProjectRepository] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Employee | null>(null)

  useEffect(() => {
    window.localStorage.setItem('forge-theme', theme)
  }, [theme])

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!projectName.trim()) return

    setCreatingProject(true)
    setError(null)
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          repository: projectRepository.trim() || undefined,
        }),
      })
      await load()
      setProjectName('')
      setProjectDescription('')
      setProjectRepository('')
      setShowProjectModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project creation failed.')
    } finally {
      setCreatingProject(false)
    }
  }


  const createIdea = async (title: string, description: string, projectId: string) => {
    setBusyId('idea:create')
    setError(null)
    try {
      await api('/api/ideas', { method: 'POST', body: JSON.stringify({ title, description, projectId, source: 'CEO' }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Idea creation failed.')
    } finally {
      setBusyId(null)
    }
  }

  const pitchIdea = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await api('/api/ideas/' + id + '/pitch', { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Athena pitch failed.')
    } finally {
      setBusyId(null)
    }
  }

  const archiveIdea = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await api('/api/ideas/' + id + '/archive', { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Idea archive failed.')
    } finally {
      setBusyId(null)
    }
  }

  const switchTheme = () => {
    if (themeTransition) return
    setThemeTransition(true)
    setTheme(theme === 'light' ? 'dark' : 'light')
    window.setTimeout(() => setThemeTransition(false), 900)
  }

  useEffect(() => {
    const onPopState = () => setView(pathToView(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextView: View) => {
    const currentIndex = viewOrder.indexOf(view)
    const nextIndex = viewOrder.indexOf(nextView)
    setViewDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
    window.history.pushState({}, '', nextView === 'overview' ? '/' : `/${nextView}`)
    setView(nextView)
  }
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)

  const runAthena = async (projectId: string) => {
    setBusyId(projectId)
    setError(null)

    try {
      await api(`/api/team-lead/projects/${projectId}/run`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await load()
      navigate('approvals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Athena run failed.')
    } finally {
      setBusyId(null)
    }
  }

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id)

    try {
      await api(`/api/agent-decisions/${id}/${action}`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }
  const pitchAction = async (id: string, action: 'approve' | 'reject' | 'request-changes') => {
    setBusyId(id)
    setError(null)
    try {
      await api(`/api/pitches/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pitch action failed.')
    } finally {
      setBusyId(null)
    }
  }

  const featureAction = async (id: string, action: string) => {
    setBusyId(id)
    setError(null)
    try {
      await api(`/api/features/${id}/${action}`, { method: 'POST' })
      await load()
      setSelectedFeature(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feature action failed.')
    } finally {
      setBusyId(null)
    }
  }

  const runArtemis = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await api(`/api/agents/artemis/tasks/${id}/review`, { method: 'POST' })
      await load()
      setSelectedTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artemis review failed.')
    } finally {
      setBusyId(null)
    }
  }

  const runHephaistos = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await api(`/api/agents/hephaistos/tasks/${id}/run`, { method: 'POST' })
      await load()
      setSelectedTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hephaistos run failed.')
    } finally {
      setBusyId(null)
    }
  }

  const taskAction = async (id: string, action: string, body?: unknown) => {
    setBusyId(id)
    setError(null)
    try {
      await api(`/api/tasks/${id}/${action}`, { method: 'POST', body: JSON.stringify(body ?? {}) })
      await load()
      setSelectedTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task action failed.')
    } finally {
      setBusyId(null)
    }
  }


  return (
    <div className={`forge-shell min-h-screen text-zinc-100 ${theme === 'light' ? 'forge-theme-light' : 'forge-theme-dark'} ${themeTransition ? 'forge-theme-transitioning' : ''}`}>
      {themeTransition && (
        <div className="forge-theme-wind" aria-hidden="true">
          <span className="forge-theme-wind__streak forge-theme-wind__streak--one" />
          <span className="forge-theme-wind__streak forge-theme-wind__streak--two" />
          <span className="forge-theme-wind__streak forge-theme-wind__streak--three" />
        </div>
      )}
      <aside className="forge-sidebar fixed inset-y-0 left-0 hidden w-64 lg:flex lg:flex-col">
        <div className="forge-brand flex h-16 items-center gap-3 px-5">
          <div className="forge-brand-mark flex size-9 items-center justify-center overflow-hidden">
            <img src="/forge-logo.svg" alt="" className="size-full object-cover" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">Forge</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">AI company HQ</div>
          </div>
        </div>

        <nav className="forge-nav flex-1 space-y-2 p-3">
          <NavItem icon={<LayoutDashboard />} label="Overview" active={view === 'overview'} onClick={() => navigate('overview')} />
          <NavItem icon={<ShieldCheck />} label="Approvals" count={pending.length + pendingPitches.length} active={view === 'approvals'} onClick={() => navigate('approvals')} />
          <NavItem icon={<Users />} label="Employees" active={view === 'employees'} onClick={() => navigate('employees')} />
          <NavItem icon={<GitPullRequest />} label="Development" active={view === 'development'} onClick={() => navigate('development')} />
          <NavItem icon={<Lightbulb />} label="Ideas" active={view === 'ideas'} onClick={() => navigate('ideas')} />
          <NavItem icon={<Activity />} label="Activity" active={view === 'activity'} onClick={() => navigate('activity')} />
        </nav>

        <div className="border-t border-white/8 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className={`size-2 rounded-full ${employees.length ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {employees.some((employee) => !employee.id.startsWith('fallback-')) ? `Crew online · ${employees.length} agents` : `Crew cached · ${employees.length} agents`}
          </div>
        </div>
      </aside>

      <main className="forge-main lg:pl-64">
        <nav className="forge-mobile-nav sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-white/8 bg-black/20 p-2 backdrop-blur lg:hidden" aria-label="Forge sections">
          {VIEW_ORDER.map((item) => (
            <button
              key={item}
              onClick={() => navigate(item)}
              aria-current={view === item ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide transition ${view === item ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              {item}
            </button>
          ))}
        </nav>
        <header className="forge-topbar sticky top-0 z-10 flex h-16 items-center justify-between px-5 lg:px-8">
          <div>
            <div className="text-xs text-zinc-500">Olympus / HQ / {view.toUpperCase()}</div>
            <h1 className="text-lg font-semibold">{view === 'overview' ? 'Company overview' : view === 'approvals' ? 'CEO approvals' : view === 'employees' ? 'Olympus roster' : view === 'development' ? 'Development floor' : 'Activity log'}</h1>
          </div>

          <div className="forge-topbar-actions">
            <button onClick={() => setShowProjectModal(true)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200">
              <Plus className="size-4" />
              New project
            </button>
            <button onClick={switchTheme} className="forge-theme-toggle cursor-pointer" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
            <button onClick={() => void load()} className="forge-refresh cursor-pointer">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <div className="forge-content mx-auto max-w-[1500px] space-y-6 p-5 lg:p-8">
          <div key={view} className={`forge-tab-stage forge-tab-stage-${viewDirection}`}>
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {view === 'overview' && (
            <Overview
              projects={projects}
              pending={pending}
              decisions={decisions}
              tasks={tasks}
              employees={employees}
              busyId={busyId}
              onApprove={(id) => void resolve(id, 'approve')}
              onReject={(id) => void resolve(id, 'reject')}
              onRunAthena={(id) => void runAthena(id)}
              onOpen={(nextView, projectId) => {
                if (projectId) setSelectedProjectId(projectId)
                navigate(nextView)
              }}
              onDecisionOpen={setSelectedDecision}
              onAgentOpen={setSelectedAgent}
            />
          )}

          {view === 'approvals' && (
            <Approvals
              pending={pending}
              pitches={pitches}
              busyId={busyId}
              onApprove={(id) => void resolve(id, 'approve')}
              onReject={(id) => void resolve(id, 'reject')}
              onOpen={setSelectedDecision}
              onPitchApprove={(id) => void pitchAction(id, 'approve')}
              onPitchReject={(id) => void pitchAction(id, 'reject')}
            />
          )}

          {view === 'employees' && <Employees employees={employees} tasks={tasks} onAgentOpen={setSelectedAgent} />}

          {view === 'ideas' && <IdeasView ideas={ideas} projects={projects} busy={busyId !== null} onCreate={createIdea} onPitch={pitchIdea} onArchive={archiveIdea} />}

      {view === 'development' && (
            <Development
              projects={projects}
              features={features}
              tasks={selectedProjectId ? tasks.filter((task) => task.feature?.projectId === selectedProjectId) : tasks}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onTaskOpen={setSelectedTask}
              onFeatureOpen={setSelectedFeature}
            />
          )}

          {view === 'activity' && <ActivityView events={auditEvents} />}
          </div>
        </div>
      </main>


      {selectedAgent && <AgentEventLogDialog employee={selectedAgent} onClose={() => setSelectedAgent(null)} />}

      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onMouseDown={() => !creatingProject && setShowProjectModal(false)}>
          <section className="forge-modal w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-white/8 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">Olympus / PROJECT REGISTRATION</div>
                <h2 id="create-project-title" className="mt-1 text-xl font-semibold">Create project</h2>
                <p className="mt-1 text-sm text-zinc-500">Register a project before Athena can start planning work.</p>
              </div>
              <button type="button" onClick={() => setShowProjectModal(false)} disabled={creatingProject} aria-label="Close" className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={(event) => void createProject(event)} className="space-y-5 p-6">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Name</span>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} autoFocus required maxLength={120} placeholder="Forge" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Description</span>
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={2000} rows={3} placeholder="Autonomous AI software team" className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Repository URL</span>
                <input value={projectRepository} onChange={(event) => setProjectRepository(event.target.value)} type="url" placeholder="https://github.com/owner/repository" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25" />
                <span className="mt-1 block text-xs text-zinc-600">Optional, but required for autonomous GitHub delivery.</span>
              </label>
              <div className="flex justify-end gap-2 border-t border-white/8 pt-5">
                <button type="button" onClick={() => setShowProjectModal(false)} disabled={creatingProject} className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/8 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={creatingProject || !projectName.trim()} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                  {creatingProject ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedFeature && (
        <FeatureDetails
          feature={selectedFeature}
          tasks={tasks.filter((task) => task.feature?.id === selectedFeature.id)}
          busy={busyId === selectedFeature.id}
          onClose={() => setSelectedFeature(null)}
          onAction={featureAction}
        />
      )}

      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          employees={employees}
          busy={busyId === selectedTask.id}
          onClose={() => setSelectedTask(null)}
          onAction={taskAction}
          onRunAgent={runHephaistos}
          onReviewAgent={runArtemis}
        />
      )}

      {selectedDecision && (
        <DecisionDetails
          decision={selectedDecision}
          busy={busyId === selectedDecision.id}
          onClose={() => setSelectedDecision(null)}
          onApprove={() => {
            setSelectedDecision(null)
            void resolve(selectedDecision.id, 'approve')
          }}
          onReject={() => {
            setSelectedDecision(null)
            void resolve(selectedDecision.id, 'reject')
          }}
        />
      )}
    </div>
  )
}


export default App
