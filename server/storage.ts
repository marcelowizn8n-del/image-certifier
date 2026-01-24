import { type Analysis, type InsertAnalysis, type User, type InsertUser, type UpdateUser, type VideoAnalysis, type InsertVideoAnalysis } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private analyses: Map<string, Analysis>;
  private videoAnalyses: Map<string, VideoAnalysis>;
  private users: Map<string, User>;

  constructor() {
    this.analyses = new Map();
    this.videoAnalyses = new Map();
    this.users = new Map();
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
}

export const storage = new MemStorage();
