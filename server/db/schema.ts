import { sql } from "drizzle-orm";
import { 
  sqliteTable, 
  text, 
  integer, 
  real,
  unique,
  boolean
} from "drizzle-orm/sqlite-core";

export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'agent'] }).notNull().default('agent'),
  agentId: integer('agent_id').references(() => agents.id),
  registrationCode: text('registration_code'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const registrationCodes = sqliteTable('registration_codes', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  used: integer('used').notNull().default(0),
  usedBy: integer('used_by').references(() => users.id),
  usedAt: text('used_at'),
}); 