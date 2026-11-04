import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';

export const HELP_REQUEST_EVENTS_QUEUE_NAME = 'help-request-events';
export const HELP_REQUEST_SUBMITTED_JOB_NAME = 'help-request-submitted';

export type HelpRequestSubmittedJob = {
  outboxEventId: string;
  helpRequestId: string;
};

const helpRequestSubmittedJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
    jitter: 0.2,
  },
  removeOnComplete: false,
  removeOnFail: false,
};

/** Sends identifier-only help-request events to the configured BullMQ queue. */
@Injectable()
export class BullMqHelpRequestEventsQueue {
  constructor(
    @InjectQueue(HELP_REQUEST_EVENTS_QUEUE_NAME)
    private readonly queue: Pick<Queue<HelpRequestSubmittedJob>, 'add'>,
  ) {}

  /** Adds one event with a stable job ID so publisher retries reuse the job. */
  async enqueue(event: HelpRequestSubmittedJob): Promise<void> {
    await this.queue.add(HELP_REQUEST_SUBMITTED_JOB_NAME, event, {
      ...helpRequestSubmittedJobOptions,
      jobId: `outbox-${event.outboxEventId}`,
    });
  }
}
