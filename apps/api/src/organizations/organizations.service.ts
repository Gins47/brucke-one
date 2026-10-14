import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { organizations } from '../database/schema';
import { DatabaseService } from '../database/database.service';
import type {
  CreateOrganizationRequest,
  OrganizationResponse,
  UpdateOrganizationRequest,
} from './organizations.dto';

type OrganizationRow = typeof organizations.$inferSelect;

/** Maps a database row to the organization response returned by the API. */
function toOrganizationResponse(row: OrganizationRow): OrganizationResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    officeAddress: row.officeAddress,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Identifies the PostgreSQL unique-constraint error used for duplicate codes. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    cause?: { code?: unknown };
  };

  return (
    databaseError.code === '23505' || databaseError.cause?.code === '23505'
  );
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  /** Creates an organization and reports a duplicate business code as a conflict. */
  async create(
    input: CreateOrganizationRequest,
  ): Promise<OrganizationResponse> {
    try {
      const [organization] = await this.database.db
        .insert(organizations)
        .values(input)
        .returning();

      return toOrganizationResponse(organization);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Organization code already exists');
      }

      throw error;
    }
  }

  /** Returns all registered organizations. */
  async findAll(): Promise<OrganizationResponse[]> {
    const records = await this.database.db.select().from(organizations);

    return records.map(toOrganizationResponse);
  }

  /** Returns one organization or a not-found response for an unknown identifier. */
  async findOne(id: string): Promise<OrganizationResponse> {
    const [organization] = await this.database.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return toOrganizationResponse(organization);
  }

  /** Updates supplied mutable fields while leaving omitted values unchanged. */
  async update(
    id: string,
    input: UpdateOrganizationRequest,
  ): Promise<OrganizationResponse> {
    const [organization] = await this.database.db
      .update(organizations)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return toOrganizationResponse(organization);
  }
}
