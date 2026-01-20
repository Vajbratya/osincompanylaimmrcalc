import { z } from "zod";

export const MrrSnapshotCurrencyRowSchema = z.object({
  currency: z.string().min(1),
  mrr: z.number(),
  mrrBase: z.number(),
  subscriptions: z.number().int().nonnegative(),
});

export const MrrApiResponseSchema = z.object({
  baseCurrency: z.string().min(1),
  generatedAt: z.string().min(1),
  snapshot: z.object({
    totalBase: z.number(),
    subscriptionsCount: z.number().int().nonnegative(),
    byCurrency: z.array(MrrSnapshotCurrencyRowSchema),
  }),
  recognized: z.object({
    months: z.array(
      z.object({
        month: z.string().regex(/^[0-9]{4}-[0-9]{2}$/),
        mrrBase: z.number(),
      })
    ),
  }),
  meta: z.object({
    fxProvider: z.string().min(1),
    warnings: z.array(z.string()),
  }),
});

export type MrrApiResponse = z.infer<typeof MrrApiResponseSchema>;
