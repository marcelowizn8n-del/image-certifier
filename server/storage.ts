import { type Analysis, type InsertAnalysis, type User, type InsertUser, type UpdateUser, type VideoAnalysis, type InsertVideoAnalysis, type AnonymousUsage, FREE_ANALYSIS_LIMIT } from "@shared/schema";
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

export class MemStorage implements IStorage {
  private analyses: Map<string, Analysis>;
  private videoAnalyses: Map<string, VideoAnalysis>;
  private users: Map<string, User>;
  private anonymousUsage: Map<string, AnonymousUsage>;

  constructor() {
    this.analyses = new Map();
    this.videoAnalyses = new Map();
    this.users = new Map();
    this.anonymousUsage = new Map();
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

  async getVideoAnalyses(): Promise<VideoAnalysis[]> {
    return Array.from(this.videoAnalyses.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getVideoAnalysis(id: string): Promise<VideoAnalysis | undefined> {
    return this.videoAnalyses.get(id);
  }

  async createVideoAnalysis(insertAnalysis: InsertVideoAnalysis): Promise<VideoAnalysis> {
    const id = randomUUID();
    const analysis: VideoAnalysis = {
      ...insertAnalysis,
      id,
      createdAt: new Date(),
    };
    this.videoAnalyses.set(id, analysis);
    return analysis;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password,
      role: "user",
      isPremium: false,
      isFreeAccount: false,
      analysisCount: 0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...updates,
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAnonymousUsage(fingerprint: string): Promise<AnonymousUsage | undefined> {
    return this.anonymousUsage.get(fingerprint);
  }

  async incrementAnonymousUsage(fingerprint: string): Promise<AnonymousUsage> {
    const existing = this.anonymousUsage.get(fingerprint);
    if (existing) {
      const updated: AnonymousUsage = {
        ...existing,
        analysisCount: existing.analysisCount + 1,
        lastAnalysisAt: new Date(),
      };
      this.anonymousUsage.set(fingerprint, updated);
      return updated;
    }

    const newUsage: AnonymousUsage = {
      id: randomUUID(),
      fingerprint,
      analysisCount: 1,
      lastAnalysisAt: new Date(),
      createdAt: new Date(),
    };
    this.anonymousUsage.set(fingerprint, newUsage);
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

export const storage = new MemStorage();
