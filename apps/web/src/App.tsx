import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
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

type Task = {
  id: string
  title: string
  status: string
  assignee?: { id: string; name: string; role: string } | null
  feature?: { title: string } | null
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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'approvals' | 'employees' | 'development' | 'activity'>('overview')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const [projectData, decisionData, taskData, employeeData] = await Promise.all([
        api<Project[]>('/api/projects'),
        api<Decision[]>('/api/agent-decisions'),
        api<Task[]>('/api/tasks'),
        api<Employee[]>('/api/employees'),
      ])

      setProjects(projectData)
      setDecisions(decisionData)
      setTasks(taskData)
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
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
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
            />
          )}

          {view === 'approvals' && (
            <Approvals
              pending={pending}
              busyId={busyId}
              onApprove={(id) => void resolve(id, 'approve')}
              onReject={(id) => void resolve(id, 'reject')}
            />
          )}

          {view === 'employees' && <Employees employees={employees} tasks={tasks} />}

          {view === 'development' && (
            <Development
              projects={projects}
              tasks={selectedProjectId ? tasks.filter((task) => task.feature?.projectId === selectedProjectId) : tasks}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
            />
          )}

          {view === 'activity' && <ActivityView decisions={decisions} />}
        </div>
                <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-zinc-400">
                  {pending.length} pending
                </span>
              </div>

              <div className="divide-y divide-white/6">
                {pending.length === 0 && (
                  <EmptyState message="No decisions are waiting for approval." />
                )}

                {pending.map((decision) => (
                  <DecisionRow
                    key={decision.id}
                    decision={decision}
                    busy={busyId === decision.id}
                    onApprove={() => void resolve(decision.id, 'approve')}
                    onReject={() => void resolve(decision.id, 'reject')}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.025]">
              <div className="border-b border-white/8 px-5 py-4">
                <h2 className="font-semibold">Projects</h2>
                <p className="mt-1 text-sm text-zinc-500">Connected products under Forge.</p>
              </div>

              <div className="divide-y divide-white/6">
                {projects.length === 0 && <EmptyState message="No projects registered yet." />}
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-white/6">
                      <CircleDot className="size-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{project.name}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {project.repository ?? 'No repository connected'}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-zinc-600" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025]">
              <div className="border-b border-white/8 px-5 py-4">
                <h2 className="font-semibold">Workforce</h2>
                <p className="mt-1 text-sm text-zinc-500">Current employees available to Forge.</p>
              </div>
              <div className="divide-y divide-white/6">
                {employees.length === 0 && <EmptyState message="No employees registered yet." />}
                {employees.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{employee.name}</div>
                      <div className="text-xs text-zinc-500">{employee.role}</div>
                    </div>
                    <span className="text-xs text-zinc-600">{employee.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.025]">
              <div className="border-b border-white/8 px-5 py-4">
                <h2 className="font-semibold">Task board</h2>
                <p className="mt-1 text-sm text-zinc-500">Work distributed by the Team Lead.</p>
              </div>
              <div className="divide-y divide-white/6">
                {tasks.length === 0 && <EmptyState message="No tasks created yet." />}
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <StatusDot status={task.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{task.title}</div>
                      <div className="text-xs text-zinc-500">
                        {task.assignee?.name ?? 'Unassigned'} · {task.assignee?.role ?? 'No manpower'}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">{task.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.025]">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="font-semibold">Recent agent activity</h2>
              <p className="mt-1 text-sm text-zinc-500">Persistent decisions produced by the company.</p>
            </div>

            <div className="divide-y divide-white/6">
              {decisions.length === 0 && <EmptyState message="No agent decisions yet." />}
              {decisions.slice(0, 8).map((decision) => (
                <div key={decision.id} className="flex items-center gap-4 px-5 py-4">
                  <StatusDot status={decision.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{decision.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {decision.agent} · {decision.project.name} · {decision.priority}
                    </div>
                  </div>
                  <div className="hidden text-xs text-zinc-600 sm:block">
                    {new Date(decision.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
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
            <button onClick={() => onOpen('approvals')} className="text-xs text-zinc-400 hover:text-white">View all →</button>
          </div>
          <div className="divide-y divide-white/6">
            {pending.length === 0 && <EmptyState message="No decisions are waiting for approval." />}
            {pending.slice(0, 3).map((decision) => (
              <DecisionRow key={decision.id} decision={decision} busy={busyId === decision.id} onApprove={() => onApprove(decision.id)} onReject={() => onReject(decision.id)} />
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
                <button onClick={() => onOpen('development', project.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white/6"><CircleDot className="size-4 text-zinc-400" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{project.name}</div>
                    <div className="truncate text-xs text-zinc-500">{project.repository ?? 'No repository connected'}</div>
                  </div>
                </button>
                <button onClick={() => onRunAthena(project.id)} disabled={busyId === project.id} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/8 disabled:opacity-50">
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
          {tasks.slice(0, 6).map((task) => <button key={task.id} onClick={() => onOpen('development', task.feature?.projectId)} className="flex w-full justify-between border-b border-white/6 px-5 py-3 text-left text-sm hover:bg-white/[0.025]"><span className="truncate">{task.title}</span><span className="ml-3 text-xs text-zinc-500">{task.status}</span></button>)}
          {tasks.length === 0 && <EmptyState message="No tasks created yet." />}
        </MiniList>
      </section>
    </>
  )
}

function Approvals({ pending, busyId, onApprove, onReject }: { pending: Decision[]; busyId: string | null; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return (
    <Panel title="CEO approvals" subtitle="Review decisions proposed by Forge agents.">
      {pending.length === 0 ? <EmptyState message="Approval queue is clear." /> : pending.map((decision) => <DecisionRow key={decision.id} decision={decision} busy={busyId === decision.id} onApprove={() => onApprove(decision.id)} onReject={() => onReject(decision.id)} />)}
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

function Development({ projects, tasks, selectedProjectId, onSelectProject }: { projects: Project[]; tasks: Task[]; selectedProjectId: string | null; onSelectProject: (id: string | null) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onSelectProject(null)} className={`rounded-lg px-3 py-2 text-sm ${!selectedProjectId ? 'bg-white text-black' : 'border border-white/10 text-zinc-400'}`}>All projects</button>
        {projects.map((project) => <button key={project.id} onClick={() => onSelectProject(project.id)} className={`rounded-lg px-3 py-2 text-sm ${selectedProjectId === project.id ? 'bg-white text-black' : 'border border-white/10 text-zinc-400'}`}>{project.name}</button>)}
      </div>
      <Panel title="Development" subtitle="Tasks distributed by the Team Lead.">
        {tasks.length === 0 ? <EmptyState message="No tasks for this selection." /> : tasks.map((task) => <div key={task.id} className="flex items-center gap-4 border-b border-white/6 px-5 py-4"><StatusDot status={task.status} /><div className="flex-1"><div className="text-sm">{task.title}</div><div className="mt-1 text-xs text-zinc-500">{task.feature?.title ?? 'Feature'} · {task.assignee?.name ?? 'Unassigned'}</div></div><span className="text-xs text-zinc-500">{task.status}</span></div>)}
      </Panel>
    </div>
  )
}

function ActivityView({ decisions }: { decisions: Decision[] }) {
  return <Panel title="Activity" subtitle="Persistent decisions produced by the company.">{decisions.length === 0 ? <EmptyState message="No agent activity yet." /> : decisions.map((decision) => <div key={decision.id} className="flex items-center gap-4 border-b border-white/6 px-5 py-4"><StatusDot status={decision.status} /><div className="flex-1"><div className="text-sm">{decision.title}</div><div className="mt-1 text-xs text-zinc-500">{decision.agent} · {decision.project.name} · {decision.priority}</div></div><span className="text-xs text-zinc-600">{new Date(decision.createdAt).toLocaleString()}</span></div>)}</Panel>
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025]"><div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-zinc-500">{subtitle}</p></div>{children}</section>
}

function MiniList({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025]"><div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><h2 className="font-semibold">{title}</h2><button onClick={onAction} className="text-xs text-zinc-400 hover:text-white">{action}</button></div>{children}</section>
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
}) {
  return (
    <div className="px-5 py-5">
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
              onClick={onApprove}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              <Check className="size-4" />
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/8 disabled:opacity-50"
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
