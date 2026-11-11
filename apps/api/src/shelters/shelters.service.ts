import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, lte } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { shelters } from '../database/schema';
import type {
  CreateShelterRequest,
  ShelterResponse,
  UpdateShelterRequest,
} from './shelters.dto';

type ShelterRow = typeof shelters.$inferSelect;

/** Maps a shelter database row to the response returned by the API. */
function toShelterResponse(row: ShelterRow): ShelterResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    shelterCode: row.shelterCode,
    name: row.name,
    address: row.address,
    countryCode: row.countryCode,
    latitude: row.latitude,
    longitude: row.longitude,
    capacity: row.capacity,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Checks PostgreSQL error codes on Drizzle errors and their underlying causes. */
function hasPostgresErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    cause?: { code?: unknown };
  };

  return databaseError.code === code || databaseError.cause?.code === code;
}

@Injectable()
export class SheltersService {
  constructor(private readonly database: DatabaseService) {}

  /** Creates a shelter and maps organization and code conflicts to API errors. */
  async create(input: CreateShelterRequest): Promise<ShelterResponse> {
    try {
      const [shelter] = await this.database.db
        .insert(shelters)
        .values(input)
        .returning();

      return toShelterResponse(shelter);
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ConflictException(
          'Shelter code already exists for this organization',
        );
      }

      if (hasPostgresErrorCode(error, '23503')) {
        throw new NotFoundException('Organization not found');
      }

      throw error;
    }
  }

  /** Returns all shelters. */
  async findAll(): Promise<ShelterResponse[]> {
    const records = await this.database.db.select().from(shelters);

    return records.map(toShelterResponse);
  }

  /** Returns one shelter or a not-found response. */
  async findOne(id: string): Promise<ShelterResponse> {
    const [shelter] = await this.database.db
      .select()
      .from(shelters)
      .where(eq(shelters.id, id))
      .limit(1);

    if (!shelter) {
      throw new NotFoundException('Shelter not found');
    }

    return toShelterResponse(shelter);
  }

  /** Updates supplied mutable shelter fields and preserves omitted values. */
  async update(
    id: string,
    input: UpdateShelterRequest,
  ): Promise<ShelterResponse> {
    const [shelter] = await this.database.db
      .update(shelters)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(shelters.id, id),
          input.capacity === undefined
            ? undefined
            : lte(shelters.capacity, input.capacity),
        ),
      )
      .returning();

    if (!shelter) {
      if (input.capacity !== undefined) {
        const [existing] = await this.database.db
          .select({ id: shelters.id })
          .from(shelters)
          .where(eq(shelters.id, id))
          .limit(1);
        if (existing)
          throw new ConflictException('Shelter capacity cannot be decreased');
      }
      throw new NotFoundException('Shelter not found');
    }

    return toShelterResponse(shelter);
  }
}
