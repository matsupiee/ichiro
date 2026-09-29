import z from "zod";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";
export const commitmentListCheckersInputSchema = z.object({ id: z.string() });
export const commitmentListCheckersOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
);
export const commitmentListCheckersRoute = protectedProcedure
  .input(commitmentListCheckersInputSchema)
  .output(commitmentListCheckersOutputSchema)
  .query(handler);
