import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const members = sqliteTable('members', {
    id: text('id').primaryKey(), preferences: text('preferences').notNull().default('{}'),
    createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
    acquisition: text('acquisition').notNull().default('direct'),
});
export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    payload: text('payload').notNull(), version: integer('version').notNull().default(1),
    createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
    preparedAt: integer('prepared_at'), returnedAt: integer('returned_at'),
}, t => [index('projects_owner_idx').on(t.ownerId)]);
export const feedback = sqliteTable('feedback', {
    id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), createdAt: integer('created_at').notNull(),
});
export const searches = sqliteTable('searches', {
    id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    payload: text('payload').notNull(), version: integer('version').notNull().default(1), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [index('searches_owner_idx').on(t.ownerId)]);
export const offerInterests = sqliteTable('offer_interests', {
    id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    offer: text('offer').notNull(), priceEuro: integer('price_euro').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('offer_interests_owner_idx').on(t.ownerId)]);
