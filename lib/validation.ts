import { z } from "zod";

// Allowed platforms can expand over time; keep loose but safe.
export const allowedPlatforms = [
  "twitter",
  "x",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "reddit",
  "bluesky",
  "other",
] as const;

export const submissionSchema = z.object({
  platform: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.toLowerCase()),
  public_handle: z.string().trim().min(1).max(80),
  display_name: z.string().trim().min(1).max(120).optional(),
  permalink: z.string().url().max(2048),
  posted_at: z.coerce.date().optional(),
  tags: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .optional()
    .default([]),
  note: z.string().trim().max(2000).optional(),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

