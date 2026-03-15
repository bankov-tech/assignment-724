import * as z from "zod";

export const Person = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  address: z.string()
});

export type Person = z.infer<typeof Person>;
