import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { Effect } from "effect";

type DrizzleDB = PostgresJsDatabase<typeof schema>;

export class DrizzleService extends Effect.Service<DrizzleService>()(
  "DrizzleService",
  {
    effect: Effect.gen(function* () {
      if (!process.env.DATABASE_URL) {
        return yield* Effect.die(
          new Error("DATABASE_URL is not set in environment variables")
        );
      }
      return drizzle(process.env.DATABASE_URL, { schema }) as DrizzleDB;
    }),
  }
) {}
