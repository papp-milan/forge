import { FeaturesService } from './features.service.js';

describe('FeaturesService lifecycle gates', () => {
  const service = (feature: any, tasks: any[]) => {
    let status = feature.status;
    const prisma = {
      feature: {
        findUnique: async () => ({ ...feature, status, tasks: feature.tasks ?? [], project: feature.project ?? { repository: 'papp-milan/forge' } }),
        findUniqueOrThrow: async () => ({ ...feature, status }),
        updateMany: async ({ where, data }: any) => {
          if (where.status !== status) return { count: 0 };
          status = data.status;
          return { count: 1 };
        },
      },
      task: { findMany: async () => tasks },
    };
    return new FeaturesService(prisma as any, {} as any, {} as any, {} as any, { hasBlockingReviews: async () => [] } as any, {} as any);
  };

  it('does not allow QA when a task is unfinished', async () => {
    const feature = service({ id: 'f1', status: 'IN_PROGRESS' }, [{ status: 'DONE' }, { status: 'IN_PROGRESS' }]);
    await expect(feature.submitForQa('f1')).rejects.toThrow('not done');
  });

  it('requires every task to be DONE before release review', async () => {
    const feature = service({ id: 'f1', status: 'QA' }, [{ status: 'DONE' }, { status: 'IN_REVIEW' }]);
    await expect(feature.approveQa('f1')).rejects.toThrow('every task');
  });

  it('uses guarded transitions instead of blind status writes', async () => {
    const feature = service({ id: 'f1', status: 'IN_PROGRESS' }, [{ status: 'DONE' }]);
    await feature.submitForQa('f1');
    await expect(feature.submitForQa('f1')).rejects.toThrow('cannot be submitted');
  });
});
