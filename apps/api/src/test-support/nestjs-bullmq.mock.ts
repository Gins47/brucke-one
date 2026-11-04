import { Inject } from '@nestjs/common';

/** Returns the queue token used by the matching test-only queue registration. */
function getQueueToken(name: string): string {
  return `BullQueue_${name}`;
}

/** Supplies the Nest BullMQ decorators for CommonJS Jest runs without Redis. */
export function InjectQueue(name: string): ParameterDecorator {
  return Inject(getQueueToken(name));
}

/** Supplies dynamic-module factories when tests do not configure a Redis queue. */
export const BullModule = {
  forRoot: () => ({ module: class BullRootTestModule {} }),
  registerQueue: ({ name }: { name: string }) => ({
    module: class BullQueueTestModule {},
    providers: [
      {
        provide: getQueueToken(name),
        useValue: { add: jest.fn().mockResolvedValue(undefined) },
      },
    ],
    exports: [getQueueToken(name)],
  }),
};
