import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import {
  emergencyOperations,
  helpRequests,
  helpRequestShelterAssignments,
  organizations,
  shelterActivationAvailability,
  shelterActivations,
  shelters,
  users,
} from '../src/database/schema';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

describe('manual shelter assignment API', () => {
  let app: INestApplication<App>;
  let db: DatabaseService;
  let token: string;
  const requestIds: string[] = [];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    db = module.get(DatabaseService);
    token = await getTestAdminAccessToken(app);
  });
  afterAll(async () => {
    if (requestIds.length) {
      await db.db
        .delete(helpRequestShelterAssignments)
        .where(
          inArray(helpRequestShelterAssignments.helpRequestId, requestIds),
        );
    }
    await app.close();
  });

  /** Creates synthetic operation, shelter, activation, availability and request. */
  async function fixture(size = 2, capacity = 4) {
    const suffix = randomUUID();
    const [org] = await db.db
      .insert(organizations)
      .values({ code: `A-${suffix.slice(0, 20)}`, name: 'Test organization' })
      .returning();
    const [operation] = await db.db
      .insert(emergencyOperations)
      .values({
        organizationId: org.id,
        operationCode: `O-${suffix}`,
        name: 'Test operation',
        countryCode: 'DE',
        type: 'FLOOD',
        severity: 'LOW',
        status: 'ACTIVE',
      })
      .returning();
    const [shelter] = await db.db
      .insert(shelters)
      .values({
        organizationId: org.id,
        shelterCode: `S-${suffix}`,
        name: 'Test shelter',
        address: 'Test address',
        countryCode: 'DE',
        capacity,
      })
      .returning();
    const [activation] = await db.db
      .insert(shelterActivations)
      .values({
        organizationId: org.id,
        shelterId: shelter.id,
        emergencyOperationId: operation.id,
        status: 'ACTIVE',
        activatedAt: new Date(),
      })
      .returning();
    await db.db.insert(shelterActivationAvailability).values({
      shelterActivationId: activation.id,
      operationalCapacity: capacity,
      currentOccupancy: 0,
      reservedPlaces: 0,
      acceptingArrivals: true,
      reportedAt: new Date('2026-01-01'),
    });
    const [help] = await db.db
      .insert(helpRequests)
      .values({
        emergencyOperationId: operation.id,
        publicReference: suffix,
        requesterName: 'Test person',
        requesterPhone: '123',
        groupSize: size,
        locationDescription: 'Test location',
        canTravelIndependently: true,
        medicalSupportNeeded: false,
      })
      .returning();
    requestIds.push(help.id);
    return { operation, shelter, activation, help };
  }
  /** Builds the operation-scoped assignment route. */
  function path(operationId: string, helpId: string) {
    return `/emergency-operations/${operationId}/help-requests/${helpId}/assignment`;
  }
  /** Submits one authorized assignment request. */
  function assign(
    f: Awaited<ReturnType<typeof fixture>>,
    helpId = f.help.id,
    activationId = f.activation.id,
  ) {
    return authenticatedRequest(app, token)
      .post(path(f.operation.id, helpId))
      .send({ shelterActivationId: activationId });
  }

  it('stores the actor and reservation, supports replay and exposes the result in the reserved queue', async () => {
    const f = await fixture();
    const first = await assign(f).expect(201);
    const body = first.body as {
      id: string;
      assignedByUserId: string;
      shelterId: string;
      reservedGroupSize: number;
    };
    const [actor] = await db.db
      .select()
      .from(users)
      .where(eq(users.id, body.assignedByUserId));
    expect(actor.username).toBe('e2e-admin');
    expect(body).toMatchObject({
      shelterId: f.shelter.id,
      reservedGroupSize: 2,
    });
    await assign(f).expect(200).expect(first.body);
    await assign(f, f.help.id, randomUUID()).expect(409);
    const [report] = await db.db
      .select()
      .from(shelterActivationAvailability)
      .where(
        eq(shelterActivationAvailability.shelterActivationId, f.activation.id),
      );
    expect(report).toMatchObject({
      reservedPlaces: 2,
      currentOccupancy: 0,
      reportedAt: new Date('2026-01-01'),
    });
    const [saved] = await db.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.id, f.help.id));
    expect(saved.status).toBe('RESERVED');
    const queue = await authenticatedRequest(app, token)
      .get(`/emergency-operations/${f.operation.id}/help-requests`)
      .query({ status: 'RESERVED' })
      .expect(200);
    expect(queue.body).toMatchObject({
      items: [
        { id: f.help.id, assignment: { id: body.id, shelterId: f.shelter.id } },
      ],
    });
    await authenticatedRequest(app, token)
      .post(`/shelter-activations/${f.activation.id}/deactivate`)
      .expect(201);
    await assign(f).expect(200);
  });

  it('replays an uppercase activation UUID without reserving again', async () => {
    const f = await fixture();
    const first = await assign(f).expect(201);
    await assign(f, f.help.id, f.activation.id.toUpperCase())
      .expect(200)
      .expect(first.body);
    const [report] = await db.db
      .select()
      .from(shelterActivationAvailability)
      .where(
        eq(shelterActivationAvailability.shelterActivationId, f.activation.id),
      );
    expect(report.reservedPlaces).toBe(f.help.groupSize);
  });

  it('serializes requests competing for the last places', async () => {
    const f = await fixture(2, 2);
    const [other] = await db.db
      .insert(helpRequests)
      .values({
        emergencyOperationId: f.operation.id,
        publicReference: randomUUID(),
        requesterName: 'Test person',
        requesterPhone: '123',
        groupSize: 2,
        locationDescription: 'Test',
        canTravelIndependently: true,
        medicalSupportNeeded: false,
      })
      .returning();
    requestIds.push(other.id);
    const outcomes = await Promise.all([assign(f), assign(f, other.id)]);
    expect(outcomes.map((x) => x.status).sort()).toEqual([201, 409]);
    const [report] = await db.db
      .select()
      .from(shelterActivationAvailability)
      .where(
        eq(shelterActivationAvailability.shelterActivationId, f.activation.id),
      );
    expect(report.reservedPlaces).toBe(2);
  });

  it('rolls back the assignment and reservation when the status update fails', async () => {
    const f = await fixture();
    await db.db.execute(
      sql`CREATE FUNCTION reject_assignment_status_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'RESERVED' THEN RAISE EXCEPTION 'forced test failure'; END IF; RETURN NEW; END $$`,
    );
    await db.db.execute(
      sql`CREATE TRIGGER reject_assignment_status_test BEFORE UPDATE ON help_requests FOR EACH ROW EXECUTE FUNCTION reject_assignment_status_test()`,
    );
    try {
      await assign(f).expect(500);
      const [report] = await db.db
        .select()
        .from(shelterActivationAvailability)
        .where(
          eq(
            shelterActivationAvailability.shelterActivationId,
            f.activation.id,
          ),
        );
      const [saved] = await db.db
        .select()
        .from(helpRequests)
        .where(eq(helpRequests.id, f.help.id));
      const assignments = await db.db
        .select()
        .from(helpRequestShelterAssignments)
        .where(eq(helpRequestShelterAssignments.helpRequestId, f.help.id));
      expect(report.reservedPlaces).toBe(0);
      expect(saved.status).toBe('PENDING_REVIEW');
      expect(assignments).toHaveLength(0);
    } finally {
      await db.db.execute(
        sql`DROP TRIGGER reject_assignment_status_test ON help_requests`,
      );
      await db.db.execute(sql`DROP FUNCTION reject_assignment_status_test()`);
    }
  });

  it('protects reservation against a stale report and a concurrent first assignment', async () => {
    const f = await fixture();
    const report = {
      operationalCapacity: 4,
      currentOccupancy: 0,
      reservedPlaces: 0,
      acceptingArrivals: true,
    };
    const put = () =>
      authenticatedRequest(app, token)
        .put(`/shelter-activations/${f.activation.id}/availability`)
        .send(report);
    const outcomes = await Promise.all([assign(f), put()]);
    expect(outcomes[0].status).toBe(201);
    expect([200, 409]).toContain(outcomes[1].status);
    await put().expect(409);
    const [saved] = await db.db
      .select()
      .from(shelterActivationAvailability)
      .where(
        eq(shelterActivationAvailability.shelterActivationId, f.activation.id),
      );
    expect(saved.reservedPlaces).toBe(2);
    await authenticatedRequest(app, token)
      .put(`/shelter-activations/${f.activation.id}/availability`)
      .send({ ...report, reservedPlaces: 2, currentOccupancy: 1 })
      .expect(200);
  });

  it('rejects unauthorized, malformed, wrong-operation and invalid capacity cases', async () => {
    const f = await fixture(3, 2);
    await request(app.getHttpServer())
      .post(path(f.operation.id, f.help.id))
      .send({ shelterActivationId: f.activation.id })
      .expect(401);
    await authenticatedRequest(app, token)
      .post(path(f.operation.id, f.help.id))
      .send({ shelterActivationId: f.activation.id, extra: true })
      .expect(400);
    await assign(f, f.help.id, randomUUID()).expect(404);
    await assign(f).expect(409);
    expect(
      await db.db
        .select()
        .from(helpRequestShelterAssignments)
        .where(eq(helpRequestShelterAssignments.helpRequestId, f.help.id)),
    ).toHaveLength(0);
    const other = await fixture();
    await assign(f, f.help.id, other.activation.id).expect(404);
    await authenticatedRequest(app, token)
      .patch(`/shelters/${f.shelter.id}`)
      .send({ capacity: 1 })
      .expect(409);
    await authenticatedRequest(app, token)
      .patch(`/shelters/${f.shelter.id}`)
      .send({ capacity: 3 })
      .expect(200);
  });

  it.each([
    'inactive activation',
    'inactive operation',
    'missing report',
    'not accepting',
  ])('rejects %s', async (condition) => {
    const f = await fixture();
    if (condition === 'inactive activation')
      await db.db
        .update(shelterActivations)
        .set({ status: 'DEACTIVATED', deactivatedAt: new Date() })
        .where(eq(shelterActivations.id, f.activation.id));
    if (condition === 'inactive operation')
      await db.db
        .update(emergencyOperations)
        .set({ status: 'COMPLETED' })
        .where(eq(emergencyOperations.id, f.operation.id));
    if (condition === 'missing report')
      await db.db
        .delete(shelterActivationAvailability)
        .where(
          eq(
            shelterActivationAvailability.shelterActivationId,
            f.activation.id,
          ),
        );
    if (condition === 'not accepting')
      await db.db
        .update(shelterActivationAvailability)
        .set({ acceptingArrivals: false })
        .where(
          eq(
            shelterActivationAvailability.shelterActivationId,
            f.activation.id,
          ),
        );
    await assign(f).expect(409);
  });
});
