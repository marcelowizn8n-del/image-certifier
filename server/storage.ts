import {
  type Analysis, type InsertAnalysis, type AnalysisResult,
  type User, type InsertUser, type UpdateUser,
  type VideoAnalysis, type InsertVideoAnalysis, type VideoAnalysisResult,
  type AnonymousUsage, FREE_ANALYSIS_LIMIT,
  users, analyses, videoAnalyses, anonymousUsage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getAnalyses(): Promise<Analysis[]>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getVideoAnalyses(): Promise<VideoAnalysis[]>;
  getVideoAnalysis(id: string): Promise<VideoAnalysis | undefined>;
  createVideoAnalysis(analysis: InsertVideoAnalysis): Promise<VideoAnalysis>;
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAnonymousUsage(fingerprint: string): Promise<AnonymousUsage | undefined>;
  incrementAnonymousUsage(fingerprint: string): Promise<AnonymousUsage>;
  canAnalyze(fingerprint: string): Promise<{ allowed: boolean; remaining: number; total: number }>;
}

export class DatabaseStorage implements IStorage {
  async getAnalyses(): Promise<Analysis[]> {
    return await db.select().from(analyses).orderBy(desc(analyses.createdAt));
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
    return analysis;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const [analysis] = await db.insert(analyses).values({
      ...insertAnalysis,
      result: insertAnalysis.result as AnalysisResult,
    }).returning();
    return analysis as Analysis;
  }

  async getVideoAnalyses(): Promise<VideoAnalysis[]> {
    return await db.select().from(videoAnalyses).orderBy(desc(videoAnalyses.createdAt));
  }

  async getVideoAnalysis(id: string): Promise<VideoAnalysis | undefined> {
    const [analysis] = await db.select().from(videoAnalyses).where(eq(videoAnalyses.id, id));
    return analysis as VideoAnalysis | undefined;
  }

  async createVideoAnalysis(insertAnalysis: InsertVideoAnalysis): Promise<VideoAnalysis> {
    const [analysis] = await db.insert(videoAnalyses).values({
      ...insertAnalysis,
      result: insertAnalysis.result as VideoAnalysisResult,
    }).returning();
    return analysis as VideoAnalysis;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAnonymousUsage(fingerprint: string): Promise<AnonymousUsage | undefined> {
    const [usage] = await db.select().from(anonymousUsage).where(eq(anonymousUsage.fingerprint, fingerprint));
    return usage;
  }

  async incrementAnonymousUsage(fingerprint: string): Promise<AnonymousUsage> {
    const existing = await this.getAnonymousUsage(fingerprint);
    if (existing) {
      const [updated] = await db.update(anonymousUsage)
        .set({
          analysisCount: existing.analysisCount + 1,
          lastAnalysisAt: new Date()
        })
        .where(eq(anonymousUsage.fingerprint, fingerprint))
        .returning();
      return updated;
    }

    const [newUsage] = await db.insert(anonymousUsage)
      .values({
        fingerprint,
        analysisCount: 1,
        lastAnalysisAt: new Date(),
      })
      .returning();
    return newUsage;
  }

  async canAnalyze(fingerprint: string): Promise<{ allowed: boolean; remaining: number; total: number }> {
    const usage = await this.getAnonymousUsage(fingerprint);
    const count = usage?.analysisCount || 0;
    const remaining = Math.max(0, FREE_ANALYSIS_LIMIT - count);
    return {
      allowed: count < FREE_ANALYSIS_LIMIT,
      remaining,
      total: FREE_ANALYSIS_LIMIT,
    };
  }
}

export const storage = new DatabaseStorage();
