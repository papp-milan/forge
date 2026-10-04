export type Project = { id: string; name: string; description?: string | null; repository?: string | null }
export type Feature = { id: string; title: string; description: string; status: string; projectId: string }
export type Task = { id: string; title: string; status: string; description?: string | null; acceptanceCriteria?: string | null; githubIssueNumber?: number | null; githubIssueUrl?: string | null; branchName?: string | null; pullRequestNumber?: number | null; pullRequestUrl?: string | null; assignee?: { id: string; name: string; role: string } | null; feature?: { id?: string; title: string; projectId: string } | null }
export type Employee = { id: string; name: string; role: string; status: string; color: string }
export type AgentActivityEvent = { id: string; timestamp: string; agent: string; source: string; kind: string; status?: string; summary: string; projectId?: string; taskId?: string; metadata?: unknown }
export type AuditEvent = { id: string; timestamp: string; actor: string; type: string; projectId?: string; entityType?: string; entityId?: string; summary: string; data?: Record<string, unknown> }
export type Decision = { id: string; agent: string; type: string; priority: string; title: string; reasoning: string; evidence: unknown; actions: unknown; requiresCeoApproval: boolean; status: string; createdAt: string; project: Project }

export type PitchTaskSuggestion = { id: string; title: string; description?: string | null; acceptanceCriteria?: string | null; role: string; risk: string }
export type Pitch = { id: string; title: string; description: string; rationale?: string | null; problem?: string | null; solution?: string | null; impact?: string | null; risks?: string | null; status: string; projectId: string; project?: Project; taskSuggestions: PitchTaskSuggestion[]; reviews?: Array<{ action: string; comment?: string | null; createdAt: string }> }

export type Idea = { id: string; title: string; description: string; source?: string | null; status: string; projectId: string; pitchId?: string | null; project?: Project; pitch?: Pitch | null }
