import {
  BullMqHelpRequestEventsQueue,
  HELP_REQUEST_EVENTS_QUEUE_NAME,
  HELP_REQUEST_SUBMITTED_JOB_NAME,
} from './help-request-events.queue';

describe('BullMqHelpRequestEventsQueue', () => {
  it('adds an identifier-only event with a stable job ID and retry settings', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = new BullMqHelpRequestEventsQueue({ add });

    await queue.enqueue({
      outboxEventId: 'event-id',
      helpRequestId: 'help-request-id',
    });

    expect(HELP_REQUEST_EVENTS_QUEUE_NAME).toBe('help-request-events');

    expect(add).toHaveBeenCalledWith(
      HELP_REQUEST_SUBMITTED_JOB_NAME,
      { outboxEventId: 'event-id', helpRequestId: 'help-request-id' },
      {
        jobId: 'outbox-event-id',
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
          jitter: 0.2,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
  });
});
