import Database from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from './migrations';
import { databaseSchema } from './schema';

export type StandupDrizzleDatabase = BetterSQLite3Database<
  typeof databaseSchema
>;

export class StandupDatabase {
  readonly sqlite: Database.Database;
  readonly db: StandupDrizzleDatabase;

  constructor(filename = ':memory:') {
    this.sqlite = new Database(filename);
    applyMigrations(this.sqlite);
    if (filename !== ':memory:') this.sqlite.pragma('journal_mode = WAL');
    this.db = drizzle(this.sqlite, { schema: databaseSchema });
  }

  ping(): boolean {
    return this.sqlite.prepare('SELECT 1 AS ok').get() !== undefined;
  }

  close(): void {
    if (this.sqlite.open) this.sqlite.close();
  }
}
