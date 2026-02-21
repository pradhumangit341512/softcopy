import { z } from "zod";
import {
  RequirementType,
  InquiryType,
  ClientStatus,
} from "@/lib/types"; // adjust path if needed

export const clientSchema = z.object({
  clientName: z.string().min(2, "Name required"),

  phone: z.string().min(10, "Invalid phone"),

  email: z.string().email("Invalid email").optional().or(z.literal("")),

  companyName: z.string().optional(),

  requirementType: z.nativeEnum(RequirementType),

  inquiryType: z.nativeEnum(InquiryType),

  budget: z.coerce.number().optional(),

  preferredLocation: z.string().optional(),

  address: z.string().optional(),

  visitingDate: z.string().optional(),

  visitingTime: z.string().optional(),

  followUpDate: z.string().optional(),

  status: z.nativeEnum(ClientStatus),

  source: z.string().optional(),

  notes: z.string().optional(),
});
