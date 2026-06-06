import { z } from 'zod';

export const CustomFieldSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, "Label is required").max(100),
  value: z.string().max(1024),
  isSecret: z.boolean().default(false),
});

export const VaultEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200),
  username: z.string().max(200).optional(),
  password: z.string().max(1024).optional(),
  url: z.string().url("Must be a valid URL").max(2048).optional().or(z.literal('')),
  icon: z.string().optional(),
  notes: z.string().max(10000).optional(),
  category: z.enum(['Logins', 'Email', 'API Keys', 'Recovery', 'Notes']).default('Logins'),
  isFavorite: z.boolean().default(false),
  customFields: z.array(CustomFieldSchema).default([]),
  createdAt: z.number(), // Unix timestamp
  updatedAt: z.number(), // Unix timestamp
});

export type CustomField = z.infer<typeof CustomFieldSchema>;
export type VaultEntry = z.infer<typeof VaultEntrySchema>;
