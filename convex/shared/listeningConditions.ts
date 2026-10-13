import { z } from "zod";

// Leaf module so both decision and audio-feedback contracts share one definition.
export const listeningConditionsZ = z
  .object({
    listeningMethod: z.enum(["headphones", "monitors", "car", "phone speaker"]),
    timeOfDay: z.string().trim().min(1).max(100),
  })
  .strict();
