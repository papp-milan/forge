export type Project = { id: string; name: string; description?: string | null; repository?: string | null }
export type Feature = { id: string; title: string; description: string; status: string; projectId: string }
export type Task = { id: string; title: string; status: string; description?: string | null; acceptanceCriteria?: string | null; githubIssueNumber?: number | null; githubIssueUrl?: string | null; branchName?: string | null; pullRequestNumber?: number | null; pullRequestUrl?: string | null; assignee?: { id: string; name: string; role: string } | null; feature?: { id?: string; title: string; projectId: string } | null }
export type Employee = { id: string; name: string; role: string; status: string; color: string }
export type AuditEvent = { id: string; timestamp: string; actor: string; type: string; projectId?: string; entityType?: string; entityId?: string; summary: string; data?: Record<string, unknown> }
export type Decision = { id: string; agent: string; type: string; priority: string; title: string; reasoning: string; evidence: unknown; actions: unknown; requiresCeoApproval: boolean; status: string; createdAt: string; project: Project }
