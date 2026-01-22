import { type Analysis, type InsertAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getAnalyses(): Promise<Analysis[]>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
}

export class MemStorage implements IStorage {
  private analyses: Map<string, Analysis>;

  constructor() {
    this.analyses = new Map();
  }

  async getAnalyses(): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const analysis: Analysis = {
      ...insertAnalysis,
      id,
      createdAt: new Date(),
    };
    this.analyses.set(id, analysis);
    return analysis;
  }
}

export const storage = new MemStorage();
