import { mysqlTable, varchar, timestamp, boolean, int, json, text } from 'drizzle-orm/mysql-core';

export const user = mysqlTable('user', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('emailVerified').notNull(),
    image: varchar('image', { length: 255 }),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
});

export const session = mysqlTable('session', {
    id: varchar('id', { length: 36 }).primaryKey(),
    expiresAt: timestamp('expiresAt').notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
    ipAddress: varchar('ipAddress', { length: 45 }),
    userAgent: text('userAgent'),
    userId: varchar('userId', { length: 36 }).notNull().references(() => user.id),
});

export const account = mysqlTable('account', {
    id: varchar('id', { length: 36 }).primaryKey(),
    accountId: varchar('accountId', { length: 255 }).notNull(),
    providerId: varchar('providerId', { length: 255 }).notNull(),
    userId: varchar('userId', { length: 36 }).notNull().references(() => user.id),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
});

export const verification = mysqlTable('verification', {
    id: varchar('id', { length: 36 }).primaryKey(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt'),
    updatedAt: timestamp('updatedAt'),
});

// --- Application Tables ---

export const projects = mysqlTable('projects', {
    id: varchar('id', { length: 36 }).primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    location: varchar('location', { length: 255 }).notNull(),
    price: varchar('price', { length: 255 }),
    description: text('description').notNull(),
    status: varchar('status', { length: 50 }).notNull(), // 'Ongoing' | 'Completed' | 'Upcoming'
    imageUrl: text('imageUrl').notNull(),
    logoUrl: text('logoUrl'),
    buildingAmenities: json('buildingAmenities').$type<string[]>(),
    order: int('order').default(0),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
});

export const projectUnits = mysqlTable('project_units', {
    id: varchar('id', { length: 36 }).primaryKey(),
    projectId: varchar('projectId', { length: 36 }).references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    size: varchar('size', { length: 100 }).notNull(),
    bedrooms: int('bedrooms').notNull(),
    bathrooms: int('bathrooms').notNull(),
    balconies: int('balconies').notNull(),
    features: json('features').$type<string[]>(),
    floorPlanImage: text('floorPlanImage'),
});

export const galleryItems = mysqlTable('gallery_items', {
    id: varchar('id', { length: 36 }).primaryKey(),
    url: text('url').notNull(),
    caption: text('caption'),
    category: varchar('category', { length: 100 }),
    createdAt: timestamp('createdAt').defaultNow(),
});

export const messages = mysqlTable('messages', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull(),
    message: text('message').notNull(),
    date: timestamp('date').defaultNow(),
    read: boolean('read').default(false),
});

export const siteSettings = mysqlTable('site_settings', {
    id: int('id').primaryKey(), // Always 1
    settings: json('settings').notNull(), // Store full JSON object for flexibility
    updatedAt: timestamp('updatedAt').defaultNow(),
});
