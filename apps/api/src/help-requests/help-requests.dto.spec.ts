import {
  encodeHelpRequestQueueCursor,
  helpRequestQueueQuerySchema,
} from './help-requests.dto';

describe('help-request queue query validation', () => {
  const cursor = encodeHelpRequestQueueCursor({
    createdAt: new Date('2026-10-03T10:00:00.000Z'),
    id: 'b740fd73-661c-435e-ba99-ad7b1ce807a9',
  });

  it('uses the pending-review queue defaults and parses an opaque cursor', () => {
    expect(helpRequestQueueQuerySchema.parse({})).toMatchObject({
      limit: 20,
      status: 'PENDING_REVIEW',
    });
    expect(
      helpRequestQueueQuerySchema.parse({
        limit: '2',
        status: 'MATCHING',
        cursor,
      }),
    ).toEqual({
      limit: 2,
      status: 'MATCHING',
      cursor: {
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
        id: 'b740fd73-661c-435e-ba99-ad7b1ce807a9',
      },
    });
  });

  it.each([
    { status: 'UNKNOWN' },
    { limit: '0' },
    { limit: '101' },
    { cursor: 'not-a-cursor' },
    { unknown: 'value' },
  ])('rejects an invalid strict queue query: %j', (query) => {
    expect(helpRequestQueueQuerySchema.safeParse(query).success).toBe(false);
  });
});
