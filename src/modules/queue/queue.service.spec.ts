import { Queue } from 'bullmq';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  it('agrega contadores de ambas as filas (principal e DLQ)', async () => {
    const main = {
      name: 'enrichment-queue',
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 3,
        active: 1,
        completed: 142,
        failed: 5,
        delayed: 0,
      }),
    } as unknown as Queue;

    const dlq = {
      name: 'enrichment-dlq',
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 2,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      }),
    } as unknown as Queue;

    const service = new QueueService(main, dlq);
    const result = await service.getMetrics();

    expect(result.queues).toHaveLength(2);
    expect(result.queues[0]).toEqual({
      name: 'enrichment-queue',
      counts: { waiting: 3, active: 1, completed: 142, failed: 5, delayed: 0 },
    });
    expect(result.queues[1].name).toBe('enrichment-dlq');
    expect(result.queues[1].counts.waiting).toBe(2);
  });

  it('preenche zero quando o BullMQ não retorna o contador', async () => {
    const queue = {
      name: 'q',
      getJobCounts: jest.fn().mockResolvedValue({}),
    } as unknown as Queue;

    const service = new QueueService(queue, queue);
    const result = await service.getMetrics();

    expect(result.queues[0].counts.waiting).toBe(0);
    expect(result.queues[0].counts.active).toBe(0);
  });
});
