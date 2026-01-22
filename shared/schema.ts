import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type UserRole = "user" | "admin";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").$type<UserRole>().default("user").notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  isFreeAccount: boolean("is_free_account").default(false).notNull(),
  analysisCount: integer("analysis_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const updateUserSchema = z.object({
  isPremium: z.boolean().optional(),
  isFreeAccount: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;

// Analysis result types
export type AnalysisResult = "original" | "ai_generated" | "ai_modified" | "uncertain";

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  result: text("result").$type<AnalysisResult>().notNull(),
  confidence: integer("confidence").notNull(),
  artifacts: jsonb("artifacts").$type<{
    compression: boolean;
    blur: boolean;
    colorAdjustment: boolean;
    noisePatterns: boolean;
    inconsistentLighting: boolean;
    edgeArtifacts: boolean;
  }>().notNull(),
  metadata: jsonb("metadata").$type<{
    width: number;
    height: number;
    format: string;
    size: number;
    hasExif: boolean;
    cameraMake?: string;
    cameraModel?: string;
  }>().notNull(),
  debugScores: jsonb("debug_scores").$type<{
    exif_score: number;
    noise_score: number;
    ai_confidence: number;
    realness_score: number;
    significant_artifacts: number;
    ml_ai_score?: number;
    ml_human_score?: number;
    ml_model?: string;
  }>(),
  imageData: text("image_data"), // Base64 encoded image for display
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

// Validation schemas for API
export const analyzeImageSchema = z.object({
  imageData: z.string(), // Base64 encoded image
  filename: z.string(),
});

export const analyzeUrlSchema = z.object({
  url: z.string().url(),
});

export type AnalyzeImageInput = z.infer<typeof analyzeImageSchema>;
export type AnalyzeUrlInput = z.infer<typeof analyzeUrlSchema>;
