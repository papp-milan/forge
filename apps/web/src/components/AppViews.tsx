import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Check, CircleDot, ExternalLink, Cpu, GitPullRequest, ShieldCheck, X, Zap } from 'lucide-react'
import type { AgentActivityEvent, AuditEvent, Decision, Employee, Feature, Idea, Pitch, Project, Task } from '../types/forge'
import { api } from '../api/client'

const METRIC_SHADOW_COLORS = ['#19e6ff', '#d7ff00', '#ff2f8a', '#ff8a00', '#8b5cf6', '#ef4444']

function createMetricShadowPlan(): Array<string | null> {
  const positions = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5)
  const colors = [...METRIC_SHADOW_COLORS].sort(() => Math.random() - 0.5)
  const count = 2 + Math.floor(Math.random() * 4)
  const plan: Array<string | null> = Array(6).fill(null)
  positions.slice(0, count).forEach((position, index) => { plan[position] = colors[index] })
  return plan
}

export function NavItem({
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
      className={`forge-nav-item flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
        active ? 'forge-nav-item--active text-white' : 'text-zinc-500 hover:text-white'
      }`}
    >
      <span className="size-4">{icon}</span>
      <span className="flex-1">{label}</span>
      {count ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{count}</span> : null}
    </button>
  )
}

export function Overview({
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
  onDecisionOpen,
  onAgentOpen,
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
  onAgentOpen: (employee: Employee) => void
}) {
  const active = decisions.filter((d) => ['APPROVED', 'IN_PROGRESS'].includes(d.status))
  const [metricShadowPlan] = useState<Array<string | null>>(() => createMetricShadowPlan())
  return (
    <div className="forge-overview-stack">
      <section className="forge-agent-pulse">
        <div className="forge-agent-pulse__title">
          <div>
            <div className="forge-kicker">OLYMPUS / AGENT PULSE</div>
            <h2 className="mt-1 text-xl font-black uppercase tracking-[-0.04em]">The company is alive.</h2>
          </div>
          <span>{employees.filter((employee) => employee.status === 'ACTIVE').length.toString().padStart(2, '0')} ACTIVE · {employees.length.toString().padStart(2, '0')} CREW</span>
        </div>
        <div className="forge-agent-pulse__grid">
          {employees.slice(0, 6).map((employee) => {
            const openTasks = tasks.filter((task) => task.assignee?.id === employee.id && task.status !== 'DONE')
            const blocked = openTasks.some((task) => task.status === 'BLOCKED')
            const state: AgentAsciiState = employee.status !== 'ACTIVE' ? 'OFFLINE' : blocked ? 'BLOCKED' : openTasks.length ? 'WORKING' : 'SLEEPING'
            return (
              <div
  key={employee.id}
  className="forge-agent-pulse__agent"
  data-agent-state={state}
  style={{ '--agent-color': employee.color } as React.CSSProperties}
>
                <button type="button" onClick={() => onAgentOpen(employee)} className="block w-full cursor-pointer text-left" aria-label={`Open ${employee.name} event logs`}><AgentAscii role={employee.role} name={employee.name} state={state} color={employee.color} /></button>
                <div className="forge-agent-pulse__meta">
                  <strong>{employee.name}</strong>
                  <span>{state} · {openTasks.length.toString().padStart(2, '0')} TASKS</span>
                </div>
              </div>
            )
          })}
          {employees.length === 0 && <EmptyState message="No agents registered yet." />}
        </div>
      </section>

      <section className="forge-metrics-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Cpu />} label="Projects" value={projects.length} shadowColor={metricShadowPlan[0]} />
        <Metric icon={<ShieldCheck />} label="Pending approval" value={pending.length} emphasis shadowColor={metricShadowPlan[1]} />
        <Metric icon={<Activity />} label="Agent decisions" value={decisions.length} shadowColor={metricShadowPlan[2]} />
        <Metric icon={<Zap />} label="Active decisions" value={active.length} shadowColor={metricShadowPlan[3]} />
        <Metric icon={<GitPullRequest />} label="Tasks" value={tasks.length} shadowColor={metricShadowPlan[4]} />
        <Metric icon={<AlertTriangle />} label="Blocked tasks" value={tasks.filter((t) => t.status === 'BLOCKED').length} emphasis={tasks.some((t) => t.status === 'BLOCKED')} shadowColor={metricShadowPlan[5]} />
      </section>

      <section className="forge-overview-grid grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
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

      <section className="forge-overview-grid grid gap-6 xl:grid-cols-2">
        <MiniList title="Workforce" action="Employees →" onAction={() => onOpen('employees')}>
          {employees.slice(0, 6).map((employee) => <div key={employee.id} className="flex items-center gap-2 border-b border-white/6 px-5 py-3 text-sm"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: employee.color }} /><span className="flex-1">{employee.name}</span><span className="text-xs text-zinc-500">{employee.role}</span></div>)}
          {employees.length === 0 && <EmptyState message="No employees registered yet." />}
        </MiniList>
        <MiniList title="Task board" action="Development →" onAction={() => onOpen('development')}>
          {tasks.slice(0, 6).map((task) => <button key={task.id} onClick={() => onOpen('development', task.feature?.projectId)} className="flex w-full cursor-pointer justify-between border-b border-white/6 px-5 py-3 text-left text-sm hover:bg-white/[0.025]"><span className="truncate">{task.title}</span><span className="ml-3 text-xs text-zinc-500">{task.status}</span></button>)}
          {tasks.length === 0 && <EmptyState message="No tasks created yet." />}
        </MiniList>
      </section>
    </div>
  )
}

export function Approvals({
  pending,
  pitches,
  busyId,
  onApprove,
  onReject,
  onOpen,
  onPitchApprove,
  onPitchReject,
}: {
  pending: Decision[]
  pitches: Pitch[]
  busyId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onOpen: (decision: Decision) => void
  onPitchApprove: (id: string) => void
  onPitchReject: (id: string) => void
}) {
  const pendingPitches = pitches.filter((pitch) => pitch.status === 'PENDING_APPROVAL')

  return (
    <div className="space-y-6">
      <Panel title="CEO approvals" subtitle="Review decisions proposed by Forge agents.">
        {pending.length === 0 ? <EmptyState message="Approval queue is clear." /> : pending.map((decision) => (
          <DecisionRow
            key={decision.id}
            decision={decision}
            busy={busyId === decision.id}
            onApprove={() => onApprove(decision.id)}
            onReject={() => onReject(decision.id)}
            onOpen={() => onOpen(decision)}
          />
        ))}
      </Panel>

      <Panel title="Feature pitches" subtitle="Athena's approved investigations become concrete product proposals here.">
        {pendingPitches.length === 0 ? <EmptyState message="No feature pitches are waiting for your decision." /> : pendingPitches.map((pitch) => (
          <PitchApprovalCard
            key={pitch.id}
            pitch={pitch}
            busy={busyId === pitch.id}
            onApprove={() => onPitchApprove(pitch.id)}
            onReject={() => onPitchReject(pitch.id)}
          />
        ))}
      </Panel>
    </div>
  )
}

function PitchApprovalCard({
  pitch,
  busy,
  onApprove,
  onReject,
}: {
  pitch: Pitch
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <article className="border-b border-white/6 px-5 py-6 last:border-0">
      <div className="flex gap-4">
        <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300">
          <GitPullRequest className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="forge-kicker">ATHENA · FEATURE PITCH</div>
            <span className="rounded-full border border-amber-400/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
              CEO GATE
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold">{pitch.title}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">{pitch.description}</p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {pitch.problem && (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[10px] uppercase tracking-wider text-zinc-600">Problem</div>
                <p className="mt-2 text-sm leading-5 text-zinc-300">{pitch.problem}</p>
              </div>
            )}
            {pitch.solution && (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[10px] uppercase tracking-wider text-zinc-600">Solution</div>
                <p className="mt-2 text-sm leading-5 text-zinc-300">{pitch.solution}</p>
              </div>
            )}
            {pitch.impact && (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[10px] uppercase tracking-wider text-zinc-600">Impact</div>
                <p className="mt-2 text-sm leading-5 text-zinc-300">{pitch.impact}</p>
              </div>
            )}
            {pitch.risks && (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[10px] uppercase tracking-wider text-zinc-600">Risks</div>
                <p className="mt-2 text-sm leading-5 text-zinc-300">{pitch.risks}</p>
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">Proposed tasks · {pitch.taskSuggestions.length}</div>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/8">
              {pitch.taskSuggestions.map((task) => (
                <div key={task.id} className="flex items-start gap-3 border-b border-white/6 px-4 py-3 last:border-0">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-200">{task.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">{task.role} · {task.risk}</div>
                    {task.acceptanceCriteria && <div className="mt-1 text-xs leading-5 text-zinc-600">{task.acceptanceCriteria}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div className="text-xs text-zinc-600">
              {pitch.project?.name ?? 'Project'} · Athena proposal · second CEO gate
            </div>
            <div className="flex gap-2">
              <button onClick={onReject} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50">
                <X className="size-4" />
                Reject pitch
              </button>
              <button onClick={onApprove} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="size-4" />
                Approve pitch
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export function Employees({ employees, tasks, onAgentOpen }: { employees: Employee[]; tasks: Task[]; onAgentOpen: (employee: Employee) => void }) {
  return (
    <section className="space-y-5">
      <div className="forge-roster-heading">
        <div>
          <div className="forge-kicker">OLYMPUS / LIVE ROSTER</div>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.04em]">The crew is online.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Every agent has a visible state. No work means sleep. A queued task wakes the agent up.
          </p>
        </div>
        <div className="forge-roster-counter">{employees.filter((employee) => employee.status === 'ACTIVE').length.toString().padStart(2, '0')} ACTIVE</div>
      </div>

      {employees.length === 0 && <Panel title="Employees" subtitle="Forge workforce and current assignment state."><EmptyState message="No employees registered yet." /></Panel>}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => {
          const assigned = tasks.filter((task) => task.assignee?.id === employee.id)
          const openTasks = assigned.filter((task) => task.status !== 'DONE')
          const blocked = openTasks.some((task) => task.status === 'BLOCKED')
          const state = employee.status !== 'ACTIVE' ? 'OFFLINE' : blocked ? 'BLOCKED' : openTasks.length > 0 ? 'WORKING' : 'SLEEPING'

          return (
            <article key={employee.id} onClick={() => onAgentOpen(employee)} className="forge-agent-card cursor-pointer" style={{ '--agent-color': employee.color } as React.CSSProperties}>
              <div className="forge-agent-card__stripe" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="forge-kicker">{employee.role.replace('_', ' ')} / AGENT</div>
                  <h3 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em]">{employee.name}</h3>
                </div>
                <span className={`forge-agent-state forge-agent-state--${state.toLowerCase()}`}>
                  <span className="forge-agent-state__dot" />
                  {state}
                </span>
              </div>

              <CharacterPoster employee={employee} state={state} openTasks={openTasks.length} totalTasks={assigned.length} />
            </article>
          )
        })}
      </div>
    </section>
  )
}

const CHARACTER_DIALOGUE: Record<string, { line: string; action: string }> = {
  Athena: { line: 'The next move is obvious. Now make it happen.', action: 'COMMAND' },
  Hephaistos: { line: 'Give me the issue. I will forge the fix.', action: 'BUILD' },
  Artemis: { line: 'Not yet. I found something worth checking.', action: 'CHECK' },
  Apollo: { line: 'If it feels right, people will understand it.', action: 'DESIGN' },
  Nike: { line: 'Green light. Let it fly.', action: 'RELEASE' },
  Atlas: { line: 'The foundation holds. Keep building.', action: 'DEPLOY' },
}

export function CharacterPoster({ employee, state, openTasks, totalTasks }: { employee: Employee; state: AgentAsciiState; openTasks: number; totalTasks: number }) {
  const dialogue = CHARACTER_DIALOGUE[employee.name] ?? { line: 'Forge is waiting for the next move.', action: 'STANDBY' }
  const characterSlug = employee.name.toLowerCase()
  return (
    <div className="forge-character-poster" style={{ '--agent-color': employee.color } as React.CSSProperties}>
      <div className="forge-character-poster__burst">{dialogue.action}!</div>
      <div className="forge-character-poster__art">
        <picture>
          <source srcSet={`/characters/${characterSlug}.png`} type="image/png" />
          <img
            src={`/characters/${characterSlug}.svg`}
            alt=""
            className="forge-character-poster__image"
          />
        </picture>
        <div className="forge-character-poster__live">
          <span className={`forge-agent-state forge-agent-state--${state.toLowerCase()}`}>
            <span className="forge-agent-state__dot" />
            {state}
          </span>
        </div>
      </div>
      <div className="forge-character-poster__dialogue">
        <div className="forge-character-poster__name">{employee.name}</div>
        <div className="forge-character-poster__line">“{dialogue.line}”</div>
        <div className="forge-character-poster__meta">
          <span>{openTasks.toString().padStart(2, '0')} OPEN</span>
          <span>{totalTasks.toString().padStart(2, '0')} TOTAL</span>
        </div>
      </div>
    </div>
  )
}

type AgentAsciiState = 'SLEEPING' | 'WORKING' | 'BLOCKED' | 'OFFLINE'

const AGENT_ASCII: Record<string, Record<AgentAsciiState, string[]>> = {
  TEAM_LEAD: {
    SLEEPING: [
      `   /\\\\\\\\
  / .--. \\\\
  | -  - |   Zz
  |  /\\\\  |
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | -  - |   zZ
  |  /\\\\  |
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | -  - |   zz
  |  /\\\\  |
  '------'`,
    ],
    WORKING: [
      `   /\\\\\\\\
  / .--. \\\\
  | o  o |   !
  |  /\\\\  |  >>
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | O  O |   !
  |  /\\\\  | >>>
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | o  o |  !!
  |  /\\\\  |  >>
  '------'`,
    ],
    BLOCKED: [
      `   /\\\\\\\\
  / .--. \\\\
  | x  x |   ?
  |  /\\\\  |  !
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | X  X |  !!!
  |  /\\\\  |  !
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | x  x |   ?
  |  /\\\\  |  !
  '------'`,
    ],
    OFFLINE: [
      `   /\\\\\\\\
  / .--. \\\\
  | .  . |
  |  /\\\\  |
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | -  - |
  |  /\\\\  |
  '------'`,
      `   /\\\\\\\\
  / .--. \\\\
  | .  . |
  |  /\\\\  |
  '------'`,
    ],
  },
  UI_UX: {
    SLEEPING: [
      `    /\\\\_/\\\\
   ( -.- )  Zz
  /|     |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( -.- )  zZ
  /|     |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( -.- )  zz
  /|     |\\\\
    /___\\\\`,
    ],
    WORKING: [
      `    /\\\\_/\\\\
   ( o.o )  /
  /|  /  |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( O.O ) --
  /|  /  |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( o.o )  \\\\\\
  /|  /  |\\\\
    /___\\\\`,
    ],
    BLOCKED: [
      `    /\\\\_/\\\\
   ( x.x )  ?
  /|  !  |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( X.X ) !!!
  /|  !  |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( x.x )  ?
  /|  !  |\\\\
    /___\\\\`,
    ],
    OFFLINE: [
      `    /\\\\_/\\\\
   ( . . )
  /|     |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( -.- )
  /|     |\\\\
    /___\\\\`,
      `    /\\\\_/\\\\
   ( . . )
  /|     |\\\\
    /___\\\\`,
    ],
  },
  ENGINEER: {
    SLEEPING: [
      `    .------.
   /| -  - |\\\\
  /_|  __  |_\\\\
  \\\\_|______|_/  Zz`,
      `    .------.
   /| -  - |\\\\
  /_|  __  |_\\\\
  \\\\_|______|_/  zZ`,
      `    .------.
   /| -  - |\\\\
  /_|  __  |_\\\\
  \\\\_|______|_/  zz`,
    ],
    WORKING: [
      `    .------.
   /| o  o |\\\\
  /_| #### |_\\\\
  \\\\_|______|_/  >>`,
      `    .------.
   /| O  O |\\\\
  /_| @@@@ |_\\\\
  \\\\_|______|_/  >>>`,
      `    .------.
   /| o  o |\\\\
  /_| #### |_\\\\
  \\\\_|______|_/  >>`,
    ],
    BLOCKED: [
      `    .------.
   /| x  x |\\\\
  /_| XXXX |_\\\\
  \\\\_|______|_/  !`,
      `    .------.
   /| X  X |\\\\
  /_| !!!! |_\\\\
  \\\\_|______|_/ !!!`,
      `    .------.
   /| x  x |\\\\
  /_| XXXX |_\\\\
  \\\\_|______|_/  !`,
    ],
    OFFLINE: [
      `    .------.
   /| .  . |\\\\
  /_|      |_\\\\
  \\\\_|______|_/`,
      `    .------.
   /| -  - |\\\\
  /_|      |_\\\\
  \\\\_|______|_/`,
      `    .------.
   /| .  . |\\\\
  /_|      |_\\\\
  \\\\_|______|_/`,
    ],
  },
  QA: {
    SLEEPING: [
      `    .-----.
   /| - - |\\\\
  /_|  _  |_\\\\
  \\\\_|_____|_/  Zz`,
      `    .-----.
   /| - - |\\\\
  /_|  _  |_\\\\
  \\\\_|_____|_/  zZ`,
      `    .-----.
   /| - - |\\\\
  /_|  _  |_\\\\
  \\\\_|_____|_/  zz`,
    ],
    WORKING: [
      `    .-----.
   /| o o |\\\\
  /_|  ?  |_\\\\
  \\\\_|_____|_/  OK`,
      `    .-----.
   /| O O |\\\\
  /_|  !  |_\\\\
  \\\\_|_____|_/ CHECK`,
      `    .-----.
   /| o o |\\\\
  /_|  ✓  |_\\\\
  \\\\_|_____|_/  OK!`,
    ],
    BLOCKED: [
      `    .-----.
   /| x x |\\\\
  /_|  !  |_\\\\
  \\\\_|_____|_/  !`,
      `    .-----.
   /| X X |\\\\
  /_| !!! |_\\\\
  \\\\_|_____|_/ !!!`,
      `    .-----.
   /| x x |\\\\
  /_|  !  |_\\\\
  \\\\_|_____|_/  !`,
    ],
    OFFLINE: [
      `    .-----.
   /| . . |\\\\
  /_|     |_\\\\
  \\\\_|_____|_/`,
      `    .-----.
   /| - - |\\\\
  /_|     |_\\\\
  \\\\_|_____|_/`,
      `    .-----.
   /| . . |\\\\
  /_|     |_\\\\
  \\\\_|_____|_/`,
    ],
  },
  NIKE: {
    SLEEPING: [
      `      /\\\\
   .-======-.
  /  [ -.- ] \\\\\\
  |    /\\\\    |  Zz
  '---====---'`,
      `      /\\\\
   .-======-.
  /  [ -.- ] \\\\\\
  |    /\\\\    |  zZ
  '---====---'`,
      `      /\\\\
   .-======-.
  /  [ -.- ] \\\\\\
  |    /\\\\    |  zz
  '---====---'`,
    ],
    WORKING: [
      `      /\\\\
   .-======-.
  /  [ o.o ] \\\\\\
  |   /||\\\\   |  >>
  '---====---'  *`,
      `      /\\\\
   .-======-.
  /  [ O.O ] \\\\\\
  |   /||\\\\   | >>> 
  '---====---' **`,
      `      /\\\\
   .-======-.
  /  [ o.o ] \\\\\\
  |   /||\\\\   |  >>
  '---====---'  *`,
    ],
    BLOCKED: [
      `      /\\\\
   .-======-.
  /  [ x.x ] \\\\\\
  |   /!!\\\\   |  !
  '---====---' !!!`,
      `      /\\\\
   .-======-.
  /  [ X.X ] \\\\\\
  |   /!!\\\\   | !!!
  '---====---' !!!`,
      `      /\\\\
   .-======-.
  /  [ x.x ] \\\\\\
  |   /!!\\\\   |  !
  '---====---' !!!`,
    ],
    OFFLINE: [
      `      /\\\\
   .-======-.
  /  [ . . ] \\\\\\
  |    /\\\\    |
  '---====---'`,
      `      /\\\\
   .-======-.
  /  [ -.- ] \\\\\\
  |    /\\\\    |
  '---====---'`,
      `      /\\\\
   .-======-.
  /  [ . . ] \\\\\\
  |    /\\\\    |
  '---====---'`,
    ],
  },
  ATLAS: {
    SLEEPING: [
      `  .------------.
 /|              |\\\\
| |   [ -.- ]    | |
| |    /|||\\\\     | |  Zz
| '----|===|-----' |`,
      `  .------------.
 /|              |\\\\
| |   [ -.- ]    | |
| |    /|||\\\\     | |  zZ
| '----|===|-----' |`,
      `  .------------.
 /|              |\\\\
| |   [ -.- ]    | |
| |    /|||\\\\     | |  zz
| '----|===|-----' |`,
    ],
    WORKING: [
      `  .------------.
 /|              |\\\\
| |   [ O.O ]    | |
| |   /||||\\\\    | |  ##
| '---|####|----' |_`,
      `  .------------.
 /|              |\\\\
| |   [ O.O ]    | |
| |  /||||||\\\\   | | ###
| '==|######|===' |_`,
      `  .------------.
 /|              |\\\\
| |   [ o.o ]    | |
| |   /||||\\\\    | |  ##
| '---|####|----' |_`,
    ],
    BLOCKED: [
      `  .------------.
 /|              |\\\\
| |   [ X.X ]    | |
| |   /||||\\\\    | | !!!
| '---|!!!!|----' |_`,
      `  .------------.
 /|              |\\\\
| |   [ X.X ]    | |
| |  /||||||\\\\   | | !!!
| '!!-|XXXX|--!!' |_`,
      `  .------------.
 /|              |\\\\
| |   [ x.x ]    | |
| |   /||||\\\\    | | !!!
| '---|!!!!|----' |_`,
    ],
    OFFLINE: [
      `  .------------.
 /|              |\\\\
| |   [ . . ]    | |
| |    /|||\\\\     | |
| '----|---|-----' |_`,
      `  .------------.
 /|              |\\\\
| |   [ -.- ]    | |
| |    /|||\\\\     | |
| '----|---|-----' |_`,
      `  .------------.
 /|              |\\\\
| |   [ . . ]    | |
| |    /|||\\\\     | |
| '----|---|-----' |_`,
    ],
  },
}

export function AgentAscii({ role, name, state, color }: { role: string; name?: string; state: AgentAsciiState; color: string }) {
  const frames = role === 'DEVOPS' && name === 'Nike' ? AGENT_ASCII.NIKE[state] : role === 'DEVOPS' && name === 'Atlas' ? AGENT_ASCII.ATLAS[state] : AGENT_ASCII[role]?.[state] ?? AGENT_ASCII.DEVOPS[state]
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (state === 'OFFLINE') return
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % frames.length), state === 'SLEEPING' ? 900 : 420)
    return () => window.clearInterval(timer)
  }, [frames, state])

  return (
    <div className="forge-ascii-agent" style={{ color }}>
      <pre aria-label={`${role} agent ${state.toLowerCase()}`}>{frames[frame]}</pre>
      <span className="forge-ascii-agent__scan" />
    </div>
  )
}

export function Development({
  projects,
  features,
  tasks,
  selectedProjectId,
  onSelectProject,
  onTaskOpen,
  onFeatureOpen,
}: {
  projects: Project[]
  features: Feature[]
  tasks: Task[]
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
          {projectFeatures.length === 0 ? <EmptyState message="No features registered for this selection." /> : projectFeatures.map((feature) => <button key={feature.id} onClick={() => onFeatureOpen(feature)} className="block w-full cursor-pointer border-b border-white/6 px-5 py-5 text-left transition hover:bg-white/[0.025]"><div className="flex items-start gap-3"><StatusDot status={feature.status} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{feature.title}</h3><span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">{feature.status}</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">{feature.description}</p><div className="mt-3 text-xs text-zinc-600">{projectTasks.filter((task) => task.feature?.id === feature.id || task.feature?.title === feature.title).length} tasks</div></div></div></button>)}
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

export function IdeasView({
  ideas,
  projects,
  busy,
  onCreate,
  onPitch,
  onArchive,
}: {
  ideas: Idea[]
  projects: Project[]
  busy: boolean
  onCreate: (title: string, description: string, projectId: string) => void
  onPitch: (id: string) => void
  onArchive: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id)
  }, [projectId, projects])

  const submit = () => {
    if (!title.trim() || !description.trim() || !projectId) return
    onCreate(title.trim(), description.trim(), projectId)
    setTitle('')
    setDescription('')
  }

  return (
    <div className="space-y-5">
      <Panel title="Ideas" subtitle="Capture product ideas, then let Athena turn them into structured pitches.">
        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_180px_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Idea title" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/20" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should Forge explore?" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/20" />
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/20">
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <button disabled={busy} onClick={submit} className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">Capture</button>
        </div>
      </Panel>

      <Panel title="Idea backlog" subtitle={`${ideas.length} captured ideas · persisted in Forge`}>
        {ideas.length === 0 ? <EmptyState message="No ideas captured yet." /> : ideas.map((idea) => (
          <div key={idea.id} className="border-b border-white/6 px-5 py-5 last:border-0">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{idea.title}</h3>
                  <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">{idea.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{idea.description}</p>
                <div className="mt-2 text-xs text-zinc-600">{idea.project?.name ?? idea.projectId}</div>
              </div>
              <div className="flex gap-2">
                {!idea.pitchId && idea.status !== 'ARCHIVED' && <button disabled={busy} onClick={() => onPitch(idea.id)} className="cursor-pointer rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50">Ask Athena</button>}
                {idea.status !== 'ARCHIVED' && <button disabled={busy} onClick={() => onArchive(idea.id)} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Archive</button>}
              </div>
            </div>
            {idea.pitch && <div className="mt-4 rounded-lg border border-emerald-400/10 bg-emerald-400/5 p-3 text-xs text-emerald-200">Pitch created · {idea.pitch.title}</div>}
          </div>
        ))}
      </Panel>
    </div>
  )
}


export function ActivityView({ events }: { events: AuditEvent[] }) {
  const [liveEvents, setLiveEvents] = useState<AgentActivityEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let active = true
    const stream = new EventSource('/api/agents/activity/stream')
    stream.onopen = () => active && setConnected(true)
    stream.onmessage = (message) => {
      try {
        const next = JSON.parse(message.data) as AgentActivityEvent[]
        if (active) setLiveEvents(next)
      } catch {
        // Ignore malformed stream frames.
      }
    }
    stream.onerror = () => active && setConnected(false)
    return () => {
      active = false
      stream.close()
    }
  }, [])

  const displayEvents = liveEvents.length > 0 ? liveEvents : events.map((event) => ({
    id: 'audit:' + event.id,
    timestamp: event.timestamp,
    agent: event.actor,
    source: 'AUDIT',
    kind: event.type,
    status: undefined,
    summary: event.summary,
    projectId: event.projectId,
    taskId: event.entityType === 'task' ? event.entityId : undefined,
    metadata: event.data,
  }))

  return (
    <Panel title="Activity" subtitle={`Global agent activity and CEO audit trail · ${connected ? 'LIVE' : 'RECONNECTING'}`}>
      {displayEvents.length === 0 ? <EmptyState message="No activity recorded yet." /> : displayEvents.map((event) => (
        <div key={event.id} className="flex items-start gap-4 border-b border-white/6 px-5 py-4">
          <StatusDot status={event.status === 'FAILED' || event.status === 'BLOCKED' || event.kind.includes('FAILED') ? 'BLOCKED' : event.status === 'COMPLETED' || event.kind.includes('COMPLETED') ? 'EXECUTED' : 'PENDING'} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm">{event.summary}</div>
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">{event.source}</span>
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">{event.kind}</span>
              {event.status && <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">{event.status}</span>}
            </div>
            <div className="mt-1 text-xs text-zinc-500">{event.agent} {event.projectId ? `· ${event.projectId}` : ''}</div>
          </div>
          <span className="shrink-0 text-xs text-zinc-600">{new Date(event.timestamp).toLocaleString()}</span>
        </div>
      ))}
    </Panel>
  )
}


export function AgentEventLogDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [events, setEvents] = useState<AgentActivityEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await api<AgentActivityEvent[]>('/api/agents/' + encodeURIComponent(employee.name) + '/activity?limit=150')
        if (active) setEvents(response)
      } catch {
        if (active) setEvents([])
      }
    }
    void load()

    const stream = new EventSource('/api/agents/' + encodeURIComponent(employee.name) + '/activity/stream')
    stream.onopen = () => active && setConnected(true)
    stream.onmessage = (message) => {
      try {
        const next = JSON.parse(message.data) as AgentActivityEvent[]
        if (active) setEvents(next)
      } catch {
        // Ignore malformed stream frames.
      }
    }
    stream.onerror = () => active && setConnected(false)

    return () => {
      active = false
      stream.close()
    }
  }, [employee.name])

  const activeNow = events.some((event) =>
    event.status === 'RUNNING' || event.status === 'IN_PROGRESS' || event.kind === 'WORKER_STARTED',
  )

  const statusFor = (event: AgentActivityEvent) =>
    event.status === 'FAILED' || event.status === 'BLOCKED' || event.kind.includes('FAILED') ? 'BLOCKED'
      : event.status === 'COMPLETED' || event.status === 'DONE' || event.kind.includes('PASSED') || event.kind.includes('COMPLETED') ? 'EXECUTED'
      : event.status === 'RUNNING' ? 'IN_PROGRESS'
      : 'PENDING'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="forge-modal max-h-[90vh] w-full max-w-4xl overflow-hidden" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">OLYMPUS / LIVE AGENT ACTIVITY</div>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="text-xl font-black uppercase tracking-[-0.03em]">{employee.name}</h2>
              <span className={connected ? 'flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300' : 'flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600'}>
                <span className={'size-1.5 rounded-full ' + (connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600')} />
                {connected ? 'Live' : 'Reconnecting'}
              </span>
              {activeNow && <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">Working</span>}
            </div>
            <p className="mt-1 text-sm text-zinc-500">{employee.role.replace('_', ' ')} · {events.length} activity events</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/8"><X className="size-4" /></button>
        </div>

        <div className="max-h-[calc(90vh-110px)] overflow-y-auto p-5">
          {events.length === 0 ? <EmptyState message="No activity recorded for this agent yet." /> : (
            <div className="relative space-y-2">
              <div className="absolute bottom-3 left-[11px] top-3 w-px bg-white/8" />
              {events.map((event) => (
                <div key={event.id} className="relative flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4 pl-3">
                  <div className="relative z-10 mt-1.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#111114]">
                    <StatusDot status={statusFor(event)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{event.summary}</span>
                      <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{event.source}</span>
                      <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{event.kind}</span>
                      {event.status && <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{event.status}</span>}
                      <span className="ml-auto text-xs text-zinc-600">{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    {(event.taskId || event.metadata != null) && (
                      <div className="mt-2">
                        {event.taskId && <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">TASK · {event.taskId}</div>}
                        {event.metadata != null && <pre className="max-h-48 overflow-auto rounded-lg bg-black/20 p-3 text-xs leading-5 text-zinc-500">{JSON.stringify(event.metadata, null, 2)}</pre>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="forge-panel"><div className="forge-panel__header"><div><div className="forge-kicker">FORGE / LIVE SYSTEM</div><h2 className="mt-1 text-lg font-black uppercase tracking-[-0.03em]">{title}</h2><p className="mt-1 text-sm text-zinc-500">{subtitle}</p></div><span className="forge-panel__mark">///</span></div>{children}</section>
}

function MiniList({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return <section className="forge-panel"><div className="forge-panel__header"><div><div className="forge-kicker">FORGE / QUEUE</div><h2 className="text-lg font-black uppercase tracking-[-0.03em]">{title}</h2></div><button onClick={onAction} className="forge-text-action cursor-pointer text-xs">{action}</button></div>{children}</section>
}

function Metric({
  icon,
  label,
  value,
  shadowColor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  emphasis?: boolean
  shadowColor?: string | null
}) {
  return (
    <div
      className={shadowColor ? 'forge-metric forge-metric--random-shadow' : 'forge-metric'}
      style={shadowColor ? { '--metric-shadow': shadowColor } as React.CSSProperties : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
        <span className="text-zinc-500">{icon}</span>
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
  onOpen,
}: {
  decision: Decision
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onOpen?: () => void
}) {
  return (
    <div
      className={onOpen ? 'forge-decision-row cursor-pointer px-5 py-5 transition' : 'forge-decision-row px-5 py-5'}
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

export function TaskDetails({task, employees, busy, onClose, onAction, onRunAgent, onReviewAgent}: {task: Task; employees: Employee[]; busy: boolean; onClose: () => void; onAction: (id: string, action: string, body?: unknown) => void; onRunAgent: (id: string) => void; onReviewAgent: (id: string) => void}) {
  const active = employees.filter((employee) => employee.status === 'ACTIVE')
  const next = task.status === 'TODO' ? ['start', 'Start task'] : task.status === 'IN_PROGRESS' ? ['submit-for-review', 'Submit for review'] : task.status === 'BLOCKED' ? ['resume', 'Resume task'] : task.status === 'IN_REVIEW' ? ['complete', 'Mark complete'] : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onMouseDown={onClose}>
      <section className="forge-modal max-h-[88vh] w-full max-w-2xl overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5"><div><div className="text-xs text-zinc-500">TASK · {task.status}</div><h2 className="mt-1 text-lg font-semibold">{task.title}</h2></div><button onClick={onClose} className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/8"><X className="size-4" /></button></div>
        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-2"><DetailStat label="Feature" value={task.feature?.title ?? 'Unknown'} /><DetailStat label="Assignee" value={task.assignee?.name ?? 'Unassigned'} /></div>
          {task.description && <p className="text-sm leading-6 text-zinc-300">{task.description}</p>}
          <div><div className="text-xs text-zinc-600">ASSIGNMENT</div><select defaultValue={task.assignee?.id ?? ''} disabled={busy} onChange={(event) => event.target.value && onAction(task.id, 'assign', {employeeId: event.target.value})} className="mt-2 w-full cursor-pointer rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300"><option value="">Unassigned</option>{active.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></div>
          <div><div className="text-xs text-zinc-600">WORKFLOW</div><div className="mt-3 flex flex-wrap gap-2">{task.assignee?.role === 'ENGINEER' && ['TODO', 'IN_PROGRESS'].includes(task.status) && task.branchName && <button disabled={busy} onClick={() => onRunAgent(task.id)} className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50">Run Hephaistos</button>}{task.status === 'IN_REVIEW' && task.branchName && <button disabled={busy} onClick={() => onReviewAgent(task.id)} className="cursor-pointer rounded-lg border border-emerald-400/20 px-3 py-2 text-sm text-emerald-200 disabled:opacity-50">Run Artemis QA</button>}{next && <button disabled={busy} onClick={() => onAction(task.id, next[0])} className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50">{next[1]}</button>}{task.status === 'IN_PROGRESS' && <button disabled={busy} onClick={() => onAction(task.id, 'block')} className="cursor-pointer rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Block</button>}</div></div>
          <div><div className="text-xs text-zinc-600">GITHUB DELIVERY</div><div className="mt-3 flex flex-wrap gap-2">{!task.githubIssueUrl && <button disabled={busy} onClick={() => onAction(task.id, 'github-issue')} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Create issue</button>}{task.githubIssueUrl && <a href={task.githubIssueUrl} target="_blank" rel="noreferrer" className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">Issue #{task.githubIssueNumber}</a>}{task.githubIssueUrl && !task.branchName && <button disabled={busy} onClick={() => onAction(task.id, 'github-branch')} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Create branch</button>}{task.branchName && <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">{task.branchName}</span>}{task.branchName && !task.pullRequestUrl && <button disabled={busy} onClick={() => onAction(task.id, 'github-pull-request')} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Create PR</button>}{task.pullRequestUrl && <a href={task.pullRequestUrl} target="_blank" rel="noreferrer" className="cursor-pointer rounded-lg bg-white px-3 py-2 text-xs font-medium text-black">PR #{task.pullRequestNumber}</a>}</div></div>
        </div>
      </section>
    </div>
  )
}

export function FeatureDetails({feature, tasks, busy, onClose, onAction}: {feature: Feature; tasks: Task[]; busy: boolean; onClose: () => void; onAction: (id: string, action: string) => void}) {
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
      <section className="forge-modal max-h-[88vh] w-full max-w-3xl overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}>
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
              <p className="mt-1 text-xs leading-5 text-zinc-500">QA has approved this feature. Releasing it will merge the feature PRs and hand the resulting main-branch change to the repository's deployment workflow.</p>
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

export function DecisionDetails({
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


