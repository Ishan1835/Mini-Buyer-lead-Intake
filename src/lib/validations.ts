import { z } from "zod";

export const leadSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  budget_min: z.number().min(0, "Budget must be positive").optional(),
  budget_max: z.number().min(0, "Budget must be positive").optional(),
  preferred_areas: z.array(z.string()).optional(),
  property_type: z.string().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'not_qualified', 'closed']).default('new'),
  source: z.enum(['website', 'referral', 'social_media', 'cold_call', 'email_campaign', 'other']).default('website'),
  priority: z.number().int().min(1).max(5).default(3),
  notes: z.string().optional(),
  next_follow_up: z.date().optional(),
}).refine((data) => {
  if (data.budget_min && data.budget_max) {
    return data.budget_min <= data.budget_max;
  }
  return true;
}, {
  message: "Minimum budget cannot be greater than maximum budget",
  path: ["budget_max"],
});

export type LeadFormData = z.infer<typeof leadSchema>;

export const csvImportSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  preferred_areas: z.string().optional(),
  property_type: z.string().optional(),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
});

export type CSVImportData = z.infer<typeof csvImportSchema>;