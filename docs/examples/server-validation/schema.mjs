// Shared by the client form and every server example on this page.
import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  age: z.number().min(18, "18+ only"),
});
