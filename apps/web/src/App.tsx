import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Cpu,
  GitPullRequest,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'

type Project = {
  id: string
  name: string
  description?: string | null
  repository?: string | null
}

type Feature = {
  id: string
  title: string
  description: string
  status: string
  projectId: string
}

type Task = {
  id: string
  title: string
  status: string
  description?: string | null
  acceptanceCriteria?: string | null
  githubIssueNumber?: number | null
  githubIssueUrl?: string | null
  branchName?: string | null
  pullRequestNumber?: number | null
  pullRequestUrl?: string | null
  assignee?: { id: string; name: string; role: string } | null
  feature?: { id?: string; title: string; projectId: string } | null
}

type Employee = {
  id: string
  name: string
  role: string
  status: string
}

type Decision = {
  id: string
  agent: string
  type: string
  priority: string
  title: string
  reasoning: string
  evidence: unknown
  actions: unknown
  requiresCeoApproval: boolean
  status: string
  createdAt: string
  project: Project
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.json()
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'approvals' | 'employees' | 'development' | 'activity'>('overview')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const [projectData, decisionData, taskData, featureData, employeeData] = await Promise.all([
        api<Project[]>('/api/projects'),
        api<Decision[]>('/api/agent-decisions'),
        api<Task[]>('/api/tasks'),
        api<Feature[]>('/api/features'),
        api<Employee[]>('/api/employees'),
      ])

      setProjects(projectData)
      setDecisions(decisionData)
      setTasks(taskData)
      setFeatures(featureData)
      setEmployees(employeeData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Forge state.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const pending = useMemo(
    () => decisions.filter((decision) => decision.status === 'PENDING'),
    [decisions],
  )

  const active = useMemo(
    () =>
      decisions.filter((decision) =>
        ['APPROVED', 'IN_PROGRESS'].includes(decision.status),
      ),
    [decisions],
  )

  const runAthena = async (projectId: string) => {
    setBusyId(projectId)
    setError(null)

    try {
      await api(`/api/team-lead/projects/${projectId}/run`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await load()
      setView('approvals')
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/8 bg-[#0c0c0f] lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-white/8 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white text-black">
            <Zap className="size-4" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">Forge</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">AI company HQ</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <NavItem icon={<LayoutDashboard />} label="Overview" active={view === 'overview'} onClick={() => setView('overview')} />
          <NavItem icon={<ShieldCheck />} label="Approvals" count={pending.length} active={view === 'approvals'} onClick={() => setView('approvals')} />
          <NavItem icon={<Users />} label="Employees" active={view === 'employees'} onClick={() => setView('employees')} />
          <NavItem icon={<GitPullRequest />} label="Development" active={view === 'development'} onClick={() => setView('development')} />
          <NavItem icon={<Activity />} label="Activity" active={view === 'activity'} onClick={() => setView('activity')} />
        </nav>

        <div className="border-t border-white/8 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="size-2 rounded-full bg-emerald-400" />
            Control plane online
          </div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/8 bg-[#09090b]/90 px-5 backdrop-blur-xl lg:px-8">
          <div>
            <div className="text-xs text-zinc-500">Olympus / HQ</div>
            <h1 className="text-lg font-semibold">Company overview</h1>
          </div>

          <button
            onClick={() => void load()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
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
                setView(nextView)
              }}
              onDecisionOpen={setSelectedDecision}
            />
          )}

          {view === 'approvals' && (
            <Approvals
              pending={pending}
              busyId={busyId}
              onApprove={(id) => void resolve(id, 'approve')}
              onReject={(id) => void resolve(id, 'reject')}
              onOpen={setSelectedDecision}
            />
          )}

          {view === 'employees' && <Employees employees={employees} tasks={tasks} />}

          {view === 'development' && (
            <Development
              projects={projects}
              features={features}
              tasks={selectedProjectId ? tasks.filter((task) => task.feature?.projectId === selectedProjectId) : tasks}
              employees={employees}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onTaskOpen={setSelectedTask}
              onFeatureOpen={setSelectedFeature}
            />
          )}

          {view === 'activity' && <ActivityView decisions={decisions} onOpen={setSelectedDecision} />}
        </div>
      </main>

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

function NavItem({
  icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  count?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active ? 'bg-white/8 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
      }`}
    >
      <span className="size-4">{icon}</span>
      <span className="flex-1">{label}</span>
      {count ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{count}</span> : null}
    </button>
  )
}

function Overview({
  projects,
  pending,
  decisions,
  tasks,
  employees,
  busyId,
  onApprove,
  onReject,
  onRunAthena,
  onOpen,
}: {
  projects: Project[]
  pending: Decision[]
  decisions: Decision[]
  tasks: Task[]
  employees: Employee[]
  busyId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRunAthena: (id: string) => void
  onOpen: (view: 'approvals' | 'employees' | 'development' | 'activity', projectId?: string) => void
  onDecisionOpen: (decision: Decision) => void
}) {
  const active = decisions.filter((d) => ['APPROVED', 'IN_PROGRESS'].includes(d.status))
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Cpu />} label="Projects" value={projects.length} />
        <Metric icon={<ShieldCheck />} label="Pending approval" value={pending.length} emphasis />
        <Metric icon={<Activity />} label="Agent decisions" value={decisions.length} />
        <Metric icon={<Zap />} label="Active decisions" value={active.length} />
        <Metric icon={<GitPullRequest />} label="Tasks" value={tasks.length} />
        <Metric icon={<AlertTriangle />} label="Blocked tasks" value={tasks.filter((t) => t.status === 'BLOCKED').length} emphasis={tasks.some((t) => t.status === 'BLOCKED')} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-white/8 bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div>
              <h2 className="font-semibold">CEO approval queue</h2>
              <p className="mt-1 text-sm text-zinc-500">Decisions waiting for your attention.</p>
            </div>
            <button onClick={() => onOpen('approvals')} className="cursor-pointer text-xs text-zinc-400 hover:text-white">View all →</button>
          </div>
          <div className="divide-y divide-white/6">
            {pending.length === 0 && <EmptyState message="No decisions are waiting for approval." />}
            {pending.slice(0, 3).map((decision) => (
              <DecisionRow key={decision.id} decision={decision} busy={busyId === decision.id} onApprove={() => onApprove(decision.id)} onReject={() => onReject(decision.id)} onOpen={() => onDecisionOpen(decision)} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025]">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="font-semibold">Projects</h2>
            <p className="mt-1 text-sm text-zinc-500">Run Athena or inspect development.</p>
          </div>
          <div className="divide-y divide-white/6">
            {projects.length === 0 && <EmptyState message="No projects registered yet." />}
            {projects.map((project) => (
              <div key={project.id} className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => onOpen('development', project.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white/6"><CircleDot className="size-4 text-zinc-400" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{project.name}</div>
                    <div className="truncate text-xs text-zinc-500">{project.repository ?? 'No repository connected'}</div>
                  </div>
                </button>
                <button onClick={() => onRunAthena(project.id)} disabled={busyId === project.id} className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50">
                  {busyId === project.id ? 'Running…' : 'Run Athena'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <MiniList title="Workforce" action="Employees →" onAction={() => onOpen('employees')}>
          {employees.slice(0, 6).map((employee) => <div key={employee.id} className="flex justify-between border-b border-white/6 px-5 py-3 text-sm"><span>{employee.name}</span><span className="text-xs text-zinc-500">{employee.role}</span></div>)}
          {employees.length === 0 && <EmptyState message="No employees registered yet." />}
        </MiniList>
        <MiniList title="Task board" action="Development →" onAction={() => onOpen('development')}>
          {tasks.slice(0, 6).map((task) => <button key={task.id} onClick={() => onOpen('development', task.feature?.projectId)} className="flex w-full cursor-pointer justify-between border-b border-white/6 px-5 py-3 text-left text-sm hover:bg-white/[0.025]"><span className="truncate">{task.title}</span><span className="ml-3 text-xs text-zinc-500">{task.status}</span></button>)}
          {tasks.length === 0 && <EmptyState message="No tasks created yet." />}
        </MiniList>
      </section>
    </>
  )
}

function Approvals({ pending, busyId, onApprove, onReject, onOpen }: { pending: Decision[]; busyId: string | null; onApprove: (id: string) => void; onReject: (id: string) => void; onOpen: (decision: Decision) => void }) {
  return (
    <Panel title="CEO approvals" subtitle="Review decisions proposed by Forge agents.">
      {pending.length === 0 ? <EmptyState message="Approval queue is clear." /> : pending.map((decision) => (
        <DecisionRow
          key={decision.id}
          decision={decision}
          busy={busyId === decision.id}
          onApprove={() => onApprove(decision.id)}
          onReject={() => onReject(decision.id)}
        />
      ))}
    </Panel>
  )
}

function Employees({ employees, tasks }: { employees: Employee[]; tasks: Task[] }) {
  return (
    <Panel title="Employees" subtitle="Forge workforce and current assignment state.">
      {employees.length === 0 && <EmptyState message="No employees registered yet." />}
      {employees.map((employee) => {
        const assigned = tasks.filter((task) => task.assignee?.id === employee.id)
        return <div key={employee.id} className="flex items-center gap-4 border-b border-white/6 px-5 py-4"><span className="size-2 rounded-full bg-emerald-400" /><div className="flex-1"><div className="text-sm font-medium">{employee.name}</div><div className="mt-1 text-xs text-zinc-500">{employee.role} · {employee.status}</div></div><span className="text-xs text-zinc-500">{assigned.length} tasks</span></div>
      })}
    </Panel>
  )
}

function Development({
  projects,
  features,
  tasks,
  employees,
  selectedProjectId,
  onSelectProject,
  onTaskOpen,
  onFeatureOpen,
}: {
  projects: Project[]
  features: Feature[]
  tasks: Task[]
  employees: Employee[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
  onTaskOpen: (task: Task) => void
  onFeatureOpen: (feature: Feature) => void
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const projectFeatures = selectedProjectId ? features.filter((feature) => feature.projectId === selectedProjectId) : features
  const projectTasks = selectedProjectId ? tasks.filter((task) => task.feature?.projectId === selectedProjectId) : tasks

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onSelectProject(null)} className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${!selectedProjectId ? 'bg-white text-black' : 'border border-white/10 text-zinc-400 hover:bg-white/5'}`}>All projects</button>
        {projects.map((project) => <button key={project.id} onClick={() => onSelectProject(project.id)} className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${selectedProjectId === project.id ? 'bg-white text-black' : 'border border-white/10 text-zinc-400 hover:bg-white/5'}`}>{project.name}</button>)}
      </div>

      {selectedProject ? <section className="rounded-2xl border border-white/8 bg-white/[0.025]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-5">
          <div className="min-w-0"><div className="text-xs uppercase tracking-[0.18em] text-zinc-600">Project</div><h2 className="mt-1 text-xl font-semibold">{selectedProject.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{selectedProject.description ?? 'No project description configured.'}</p></div>
          {selectedProject.repository && <a href={selectedProject.repository} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/8"><ExternalLink className="size-3.5" />GitHub repository</a>}
        </div>
        <div className="grid gap-px border-b border-white/8 bg-white/8 sm:grid-cols-3"><ProjectStat label="Features" value={projectFeatures.length} /><ProjectStat label="Tasks" value={projectTasks.length} /><ProjectStat label="Blocked" value={projectTasks.filter((task) => task.status === 'BLOCKED').length} /></div>
      </section> : <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-6"><div className="text-xs uppercase tracking-[0.18em] text-zinc-600">Development</div><h2 className="mt-1 text-xl font-semibold">All project work</h2><p className="mt-2 text-sm text-zinc-500">Select a project to inspect its features and delivery pipeline.</p></section>}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Features" subtitle={selectedProject ? `Features proposed and managed for ${selectedProject.name}.` : 'Features across all projects.'}>
          {projectFeatures.length === 0 ? <EmptyState message="No features registered for this selection." /> : projectFeatures.map((feature) => <button key={feature.id} onClick={() => onFeatureOpen(feature)} className="block w-full cursor-pointer border-b border-white/6 px-5 py-5 text-left transition hover:bg-white/[0.025]"><div className="flex items-start gap-3"><StatusDot status={feature.status} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{feature.title}</h3><span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">{feature.status}</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">{feature.description}</p><div className="mt-3 text-xs text-zinc-600">{projectTasks.filter((task) => task.feature?.id === feature.id || task.feature?.title === feature.title).length} tasks</div></div></div></div></button>)}
        </Panel>

        <Panel title="Tasks" subtitle={selectedProject ? `Delivery work for ${selectedProject.name}. Click a task to manage it.` : 'Delivery work across all projects.'}>
          {projectTasks.length === 0 ? <EmptyState message="No tasks for this selection." /> : projectTasks.map((task) => (
            <button key={task.id} onClick={() => onTaskOpen(task)} className="block w-full cursor-pointer border-b border-white/6 px-5 py-5 text-left transition hover:bg-white/[0.025]">
              <div className="flex items-start gap-3"><StatusDot status={task.status} /><div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{task.title}</h3><span className="text-[10px] uppercase tracking-wider text-zinc-600">{task.status}</span></div>
                <div className="mt-1 text-xs text-zinc-500">{task.feature?.title ?? 'Feature'} · {task.assignee?.name ?? 'Unassigned'}</div>
                {task.description && <p className="mt-2 text-xs leading-5 text-zinc-600">{task.description}</p>}
                <div className="mt-4 flex flex-wrap gap-2">{task.githubIssueUrl && <span className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-zinc-400">Issue #{task.githubIssueNumber}</span>}{task.pullRequestUrl && <span className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-zinc-400">PR #{task.pullRequestNumber}</span>}{task.branchName && <span className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-zinc-600">{task.branchName}</span>}</div>
              </div></div>
            </button>
          ))}
        </Panel>
      </div>
    </div>
  )
}


function ProjectStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#111114] px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function ActivityView({ decisions, onOpen }: { decisions: Decision[]; onOpen: (decision: Decision) => void }) {
  return (
    <Panel title="Activity" subtitle="Persistent decisions produced by the company.">
      {decisions.length === 0 ? <EmptyState message="No agent activity yet." /> : decisions.map((decision) => (
        <button
          key={decision.id}
          onClick={() => onOpen(decision)}
          className="flex w-full cursor-pointer items-center gap-4 border-b border-white/6 px-5 py-4 text-left hover:bg-white/[0.025]"
        >
          <StatusDot status={decision.status} />
          <div className="flex-1">
            <div className="text-sm">{decision.title}</div>
            <div className="mt-1 text-xs text-zinc-500">{decision.agent} · {decision.project.name} · {decision.priority}</div>
          </div>
          <span className="text-xs text-zinc-600">{new Date(decision.createdAt).toLocaleString()}</span>
        </button>
      ))}
    </Panel>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025]"><div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-zinc-500">{subtitle}</p></div>{children}</section>
}

function MiniList({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025]"><div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><h2 className="font-semibold">{title}</h2><button onClick={onAction} className="cursor-pointer text-xs text-zinc-400 hover:text-white">{action}</button></div>{children}</section>
}

function Metric({
  icon,
  label,
  value,
  emphasis,
}: {
  icon: React.ReactNode
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
        <span className={emphasis ? 'text-amber-300' : 'text-zinc-500'}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  )
}

function DecisionRow({
  decision,
  busy,
  onApprove,
  onReject,
}: {
  decision: Decision
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onOpen?: () => void
}) {
  return (
    <div
      className={onOpen ? 'cursor-pointer px-5 py-5 transition hover:bg-white/[0.02]' : 'px-5 py-5'}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="flex gap-4">
        <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
          <ShieldCheck className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{decision.title}</h3>
            <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
              {decision.priority}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{decision.reasoning}</p>
          <div className="mt-3 text-xs text-zinc-600">
            {decision.agent} · {decision.project.name} · {new Date(decision.createdAt).toLocaleString()}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation()
                onApprove()
              }}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="size-4" />
              Approve
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onReject()
              }}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-4" />
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskDetails({task, employees, busy, onClose, onAction}: {task: Task; employees: Employee[]; busy: boolean; onClose: () => void; onAction: (id: string, action: string, body?: unknown) => void}) {
  const active = employees.filter((employee) => employee.status === 'ACTIVE')
  const next = task.status === 'TODO' ? ['start', 'Start task'] : task.status === 'IN_PROGRESS' ? ['submit-for-review', 'Submit for review'] : task.status === 'BLOCKED' ? ['resume', 'Resume task'] : task.status === 'IN_REVIEW' ? ['complete', 'Mark complete'] : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onMouseDown={onClose}>
      <section className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111114] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5"><div><div className="text-xs text-zinc-500">TASK · {task.status}</div><h2 className="mt-1 text-lg font-semibold">{task.title}</h2></div><button onClick={onClose} className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/8"><X className="size-4" /></button></div>
        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-2"><DetailStat label="Feature" value={task.feature?.title ?? 'Unknown'} /><DetailStat label="Assignee" value={task.assignee?.name ?? 'Unassigned'} /></div>
          {task.description && <p className="text-sm leading-6 text-zinc-300">{task.description}</p>}
          <div><div className="text-xs text-zinc-600">ASSIGNMENT</div><select defaultValue={task.assignee?.id ?? ''} disabled={busy} onChange={(event) => event.target.value && onAction(task.id, 'assign', {employeeId: event.target.value})} className="mt-2 w-full cursor-pointer rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300"><option value="">Unassigned</option>{active.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></div>
          <div><div className="text-xs text-zinc-600">WORKFLOW</div><div className="mt-3 flex flex-wrap gap-2">{next && <button disabled={busy} onClick={() => onAction(task.id, next[0])} className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50">{next[1]}</button>}{task.status === 'IN_PROGRESS' && <button disabled={busy} onClick={() => onAction(task.id, 'block')} className="cursor-pointer rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Block</button>}</div></div>
          <div><div className="text-xs text-zinc-600">GITHUB DELIVERY</div><div className="mt-3 flex flex-wrap gap-2">{!task.githubIssueUrl && <button disabled={busy} onClick={() => onAction(task.id, 'github-issue')} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Create issue</button>}{task.githubIssueUrl && <a href={task.githubIssueUrl} target="_blank" rel="noreferrer" className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">Issue #{task.githubIssueNumber}</a>}{task.githubIssueUrl && !task.branchName && <button disabled={busy} onClick={() => onAction(task.id, 'github-branch')} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Create branch</button>}{task.branchName && <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">{task.branchName}</span>}{task.branchName && !task.pullRequestUrl && <button disabled={busy} onClick={() => onAction(task.id, 'github-pull-request')} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Create PR</button>}{task.pullRequestUrl && <a href={task.pullRequestUrl} target="_blank" rel="noreferrer" className="cursor-pointer rounded-lg bg-white px-3 py-2 text-xs font-medium text-black">PR #{task.pullRequestNumber}</a>}</div></div>
        </div>
      </section>
    </div>
  )
}

function FeatureDetails({feature, tasks, busy, onClose, onAction}: {feature: Feature; tasks: Task[]; busy: boolean; onClose: () => void; onAction: (id: string, action: string) => void}) {
  const counts = {
    todo: tasks.filter((task) => task.status === 'TODO').length,
    active: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
    review: tasks.filter((task) => task.status === 'IN_REVIEW').length,
    done: tasks.filter((task) => task.status === 'DONE').length,
    blocked: tasks.filter((task) => task.status === 'BLOCKED').length,
  }
  const action = feature.status === 'PROPOSED' ? ['plan', 'Plan feature'] :
    feature.status === 'PLANNED' ? ['start', 'Start development'] :
    feature.status === 'IN_PROGRESS' ? ['submit-for-qa', 'Submit to QA'] :
    feature.status === 'QA' ? ['approve-qa', 'Approve QA'] :
    feature.status === 'READY_FOR_REVIEW' ? ['release', 'Release to production'] : null
  const releaseGate = feature.status === 'READY_FOR_REVIEW'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111114] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5">
          <div><div className="text-xs uppercase tracking-wider text-zinc-500">Feature · {feature.status}</div><h2 className="mt-1 text-xl font-semibold">{feature.title}</h2></div>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/8"><X className="size-4" /></button>
        </div>
        <div className="space-y-6 p-6">
          <p className="text-sm leading-6 text-zinc-300">{feature.description}</p>

          <div className="grid gap-3 sm:grid-cols-5">
            <DetailStat label="Todo" value={String(counts.todo)} />
            <DetailStat label="Active" value={String(counts.active)} />
            <DetailStat label="Review" value={String(counts.review)} />
            <DetailStat label="Done" value={String(counts.done)} />
            <DetailStat label="Blocked" value={String(counts.blocked)} />
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Delivery pipeline</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {['PROPOSED','PLANNED','IN_PROGRESS','QA','READY_FOR_REVIEW','RELEASED'].map((status, index) => (
                <span key={status} className={`rounded-full border px-3 py-1.5 ${status === feature.status ? 'border-white/25 bg-white/10 text-white' : index < ['PROPOSED','PLANNED','IN_PROGRESS','QA','READY_FOR_REVIEW','RELEASED'].indexOf(feature.status) ? 'border-emerald-400/20 text-emerald-300' : 'border-white/8 text-zinc-600'}`}>
                  {status}
                </span>
              ))}
            </div>
          </div>

          {feature.status === 'QA' && (
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-200"><ShieldCheck className="size-4" />QA gate</div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">The feature is waiting for QA approval before it can enter the CEO release queue.</p>
            </div>
          )}

          {releaseGate && (
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-200"><Check className="size-4" />CEO release gate</div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">QA has approved this feature. Releasing it will mark the feature as production-ready and hand deployment to DevOps/GitHub Actions.</p>
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Tasks</div>
            <div className="mt-3 overflow-hidden rounded-xl border border-white/8">
              {tasks.length === 0 ? <EmptyState message="No tasks attached to this feature." /> : tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 border-b border-white/6 px-4 py-3 last:border-0">
                  <StatusDot status={task.status} /><div className="min-w-0 flex-1"><div className="truncate text-sm">{task.title}</div><div className="text-xs text-zinc-600">{task.assignee?.name ?? 'Unassigned'} · {task.status}</div></div>
                </div>
              ))}
            </div>
          </div>

          {action && (
            <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-5">
              <div className="text-xs text-zinc-600">{releaseGate ? 'This is the final human release decision.' : 'Advance the feature to the next lifecycle stage.'}</div>
              <button disabled={busy} onClick={() => onAction(feature.id, action[0])} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${releaseGate ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white text-black hover:bg-zinc-200'}`}>
                {action[1]}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DecisionDetails({
  decision,
  busy,
  onClose,
  onApprove,
  onReject,
}: {
  decision: Decision
  busy: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const details = (value: unknown) => {
    if (value == null) return 'None'
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-details-title"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111114] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">{decision.agent} · {decision.type}</div>
            <h2 id="decision-details-title" className="mt-1 text-lg font-semibold">{decision.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/8 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Reasoning</div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{decision.reasoning}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DetailStat label="Priority" value={decision.priority} />
            <DetailStat label="Status" value={decision.status} />
            <DetailStat label="Project" value={decision.project.name} />
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Evidence</div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-white/8 bg-black/20 p-4 text-xs leading-5 text-zinc-400">{details(decision.evidence)}</pre>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-600">Proposed actions</div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-white/8 bg-black/20 p-4 text-xs leading-5 text-zinc-400">{details(decision.actions)}</pre>
          </div>

          {decision.status === 'PENDING' && (
            <div className="flex gap-2 border-t border-white/8 pt-5">
              <button onClick={onApprove} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="size-4" />
                Approve & execute
              </button>
              <button onClick={onReject} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50">
                <X className="size-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-1 truncate text-sm text-zinc-300">{value}</div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'EXECUTED'
      ? 'bg-emerald-400'
      : status === 'PENDING'
        ? 'bg-amber-400'
        : status === 'FAILED' || status === 'BLOCKED'
          ? 'bg-red-400'
          : 'bg-zinc-500'

  return <span className={`size-2 shrink-0 rounded-full ${color}`} />
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-5 py-10 text-center text-sm text-zinc-600">{message}</div>
}


export default App
