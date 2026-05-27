import { notFound } from "../../http/errors.js";
import type { BatchesRepository } from "./repository.js";
import type { Batch, CreateBatchInput } from "./types.js";

export class BatchesService {
  constructor(private readonly repository: BatchesRepository) {}

  listBatches(organizationId: string) {
    return this.repository.listByOrganization(organizationId);
  }

  listMyBatches(studentId: string, organizationId: string) {
    return this.repository.listForStudent(studentId, organizationId);
  }

  async createBatch(input: CreateBatchInput): Promise<Batch> {
    return this.repository.insert(input);
  }

  async enrollStudent(batchId: string, studentId: string): Promise<void> {
    const batch = await this.repository.findById(batchId);
    if (!batch) throw notFound("Batch not found.");
    await this.repository.enrollStudent(batchId, studentId);
  }

  listAttendance(organizationId: string, batchId: string, sessionDate: string) {
    return this.repository.listAttendance(organizationId, batchId, sessionDate);
  }

  async markAttendance(input: {
    organizationId: string;
    batchId: string;
    studentId: string;
    sessionDate: string;
    status: "present" | "absent" | "late";
    markedBy: string;
    notes?: string;
  }) {
    const batch = await this.repository.findById(input.batchId);
    if (!batch || batch.organizationId !== input.organizationId) {
      throw notFound("Batch not found.");
    }
    return this.repository.upsertAttendance(input);
  }
}
