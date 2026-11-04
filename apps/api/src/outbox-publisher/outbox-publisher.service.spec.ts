import type { DatabaseService } from '../database/database.service';
import { Logger } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm/sql';
import { BullMqHelpRequestEventsQueue } from './help-request-events.queue';
import { OutboxPublisherService } from './outbox-publisher.service';

const pendingEvent = {
  id: 'event-id',
  helpRequestId: 'help-request-id',
};
const secondPendingEvent = {
  id: 'second-event-id',
  helpRequestId: 'second-help-request-id',
};

type UpdateValues = Record<string, unknown>;

/** Builds a small Drizzle chain mock for publisher read and update tests. */
function createDatabase(events: (typeof pendingEvent)[][]) {
  const limit = jest
    .fn()
    .mockResolvedValue([])
    .mockResolvedValueOnce(events[0])
    .mockResolvedValueOnce(events[1] ?? []);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn((values: UpdateValues) => {
    void values;
    return { where: updateWhere };
  });
  const update = jest.fn(() => ({ set }));

  return {
    db: { select, update },
    select,
    where,
    update,
    set,
    updateWhere,
  };
}

describe('OutboxPublisherService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks a pending event enqueued after the queue accepts its job', async () => {
    const database = createDatabase([[pendingEvent]]);
    const enqueue = jest.fn<Promise<void>, [typeof pendingEvent]>();
    enqueue.mockResolvedValue(undefined);
    const queue = { enqueue } as unknown as BullMqHelpRequestEventsQueue;
    const service = new OutboxPublisherService(
      database as unknown as DatabaseService,
      queue,
    );

    await expect(service.publishPendingEvents()).resolves.toBe(1);

    expect(enqueue).toHaveBeenCalledWith({
      outboxEventId: pendingEvent.id,
      helpRequestId: pendingEvent.helpRequestId,
    });
    const [successUpdate] = database.set.mock.calls[0];
    expect(successUpdate.enqueuedAt).toBeInstanceOf(Date);
    expect(successUpdate.lastError).toBeNull();
    expect(successUpdate).not.toHaveProperty('processedAt');
  });

  it('retains a pending event with only safe diagnostics when queue publication fails', async () => {
    const database = createDatabase([[pendingEvent, secondPendingEvent]]);
    const enqueue = jest.fn<Promise<void>, [typeof pendingEvent]>();
    enqueue.mockRejectedValueOnce(new Error('redis://user:secret@host'));
    enqueue.mockResolvedValueOnce(undefined);
    const queue = { enqueue } as unknown as BullMqHelpRequestEventsQueue;
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new OutboxPublisherService(
      database as unknown as DatabaseService,
      queue,
    );

    await expect(service.publishPendingEvents()).resolves.toBe(1);

    const [failureUpdate] = database.set.mock.calls[0];
    expect(failureUpdate.lastError).toBe('Queue publication failed');
    expect(failureUpdate).toHaveProperty('attemptCount');
    expect(failureUpdate).not.toHaveProperty('enqueuedAt');
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith(
      'Outbox event event-id was not published and will be retried: <redis-url>',
    );
  });

  it('retries a previously failed event and skips an already-enqueued batch', async () => {
    const database = createDatabase([[pendingEvent], [pendingEvent]]);
    const enqueue = jest.fn<Promise<void>, [typeof pendingEvent]>();
    enqueue.mockRejectedValueOnce(new Error('queue unavailable'));
    enqueue.mockResolvedValueOnce(undefined);
    const queue = { enqueue } as unknown as BullMqHelpRequestEventsQueue;
    const service = new OutboxPublisherService(
      database as unknown as DatabaseService,
      queue,
    );

    await expect(service.publishPendingEvents()).resolves.toBe(0);
    await expect(service.publishPendingEvents()).resolves.toBe(1);
    await expect(service.publishPendingEvents()).resolves.toBe(0);

    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('queries only pending help-request-submitted events', async () => {
    const database = createDatabase([[]]);
    const enqueue = jest.fn<Promise<void>, [typeof pendingEvent]>();
    const queue = { enqueue } as unknown as BullMqHelpRequestEventsQueue;
    const service = new OutboxPublisherService(
      database as unknown as DatabaseService,
      queue,
    );

    await service.publishPendingEvents();

    const [pendingEventCondition] = database.where.mock.calls[0] as [SQL];
    const query = new PgDialect().sqlToQuery(pendingEventCondition);

    expect(query.sql).toContain('"outbox_events"."enqueued_at" is null');
    expect(query.sql).toContain('"outbox_events"."event_type" = $1');
    expect(query.params).toEqual(['help-request-submitted']);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
