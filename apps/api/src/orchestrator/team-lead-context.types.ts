export interface TeamLeadContext {
  generatedAt: string;

  project: {
    id: string;
    name: string;
    description: string | null;
    repository: string | null;
  };

  health: {
    openTasks: number;
    blockedTasks: number;
    tasksInReview: number;
    activeFeatures: number;
    pendingPitches: number;
    readyForRelease: { id: string; title: string }[];
  };

  work: {
    activeTasks: unknown[];
    blockedTasks: unknown[];
    recentCompletedTasks: unknown[];
  };

  github: {
    repository: unknown;
    issues: unknown[];
    pullRequests: unknown[];
    branches: unknown[];
    recentCommits: unknown[];
  } | null;

  communications: unknown[];

  memory: {
    company: unknown[];
    project: unknown[];
    decisions: unknown[];
    learnings: unknown[];
  };

  signals: {
    blockers: string[];
    inconsistencies: string[];
    opportunities: string[];
  };
}
