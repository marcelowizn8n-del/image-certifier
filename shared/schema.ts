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
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
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
  password: z.string().optional(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
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
    artifact_score?: number;
    ela_score?: number;
    technical_score?: number;
    ml_ai_score?: number;
    ml_human_score?: number;
    ml_model?: string;
    noise_level?: number;
    noise_consistency?: number;
    ai_reasoning?: string;
    ai_detected_artifacts?: string[];
    ml_error?: string;
  }>(),
  imageData: text("image_data"), // Base64 encoded image for display
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisFeedback = pgTable("analysis_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().unique(),
  correctLabel: text("correct_label").$type<AnalysisResult>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export type AnalysisFeedback = typeof analysisFeedback.$inferSelect;

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

// Video analysis result types
export type VideoAnalysisResult = "authentic" | "deepfake" | "manipulated" | "uncertain";

export const videoAnalyses = pgTable("video_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  result: text("result").$type<VideoAnalysisResult>().notNull(),
  confidence: integer("confidence").notNull(),
  manipulationScore: integer("manipulation_score").notNull(),
  indicators: jsonb("indicators").$type<{
    facialArtifacts: boolean;
    temporalInconsistencies: boolean;
    audioVideoMismatch: boolean;
    lipSyncIssues: boolean;
    blinkingAnomalies: boolean;
    backgroundArtifacts: boolean;
  }>().notNull(),
  metadata: jsonb("metadata").$type<{
    duration: number;
    width: number;
    height: number;
    format: string;
    size: number;
    fps?: number;
  }>().notNull(),
  thumbnailData: text("thumbnail_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoAnalysisSchema = createInsertSchema(videoAnalyses).omit({
  id: true,
  createdAt: true,
});

export type InsertVideoAnalysis = z.infer<typeof insertVideoAnalysisSchema>;
export type VideoAnalysis = typeof videoAnalyses.$inferSelect;

export const analyzeVideoSchema = z.object({
  videoData: z.string(),
  filename: z.string(),
});

export type AnalyzeVideoInput = z.infer<typeof analyzeVideoSchema>;

// Anonymous usage tracking for freemium limit
export const anonymousUsage = pgTable("anonymous_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fingerprint: text("fingerprint").notNull().unique(),
  analysisCount: integer("analysis_count").default(0).notNull(),
  lastAnalysisAt: timestamp("last_analysis_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AnonymousUsage = typeof anonymousUsage.$inferSelect;

// API keys (for paid API access)
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  monthlyQuota: integer("monthly_quota").default(5000).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type ApiKey = typeof apiKeys.$inferSelect;

export const apiKeyUsageMonthly = pgTable("api_key_usage_monthly", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").notNull(),
  yearMonth: text("year_month").notNull(), // YYYY-MM
  count: integer("count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ApiKeyUsageMonthly = typeof apiKeyUsageMonthly.$inferSelect;

// Freemium constants
export const FREE_ANALYSIS_LIMIT = 10;
