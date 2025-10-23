import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Exported bindings. We'll assign them below depending on environment.
let pool: any;
let db: any;

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "WARNING: DATABASE_URL is not set. Running with a development DB stub. " +
        "Any API calls that require the database will throw a clear error."
    );

    const throwing = () => {
      throw new Error(
        "No DATABASE_URL provided. This operation requires a real database. " +
          "Set DATABASE_URL to your Neon/Postgres connection string or run the app with a test database."
      );
    };

    const dbStub: any = {
      select: () => ({ from: throwing }),
      insert: () => ({ values: throwing }),
      update: () => ({ set: throwing }),
      delete: () => ({ where: throwing }),
      then: (_resolve: any, reject: any) => reject(new Error("No DATABASE_URL provided.")),
    };

    pool = undefined;
    db = dbStub;
  } else {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { pool, db };
