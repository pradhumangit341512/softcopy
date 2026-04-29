/**
 * Registry of all migrations. Add new ones here in order.
 * Files are discovered explicitly (not via glob) so the build bundles them
 * deterministically — important because the API route runs in a compiled
 * environment where dynamic filesystem reads don't work on Vercel.
 */

import type { Migration } from './_runner';
import { migration as m000 } from './000_backfill_schema_fields';
import { migration as m001 } from './001_seed_company_subscription_defaults';
import { migration as m002 } from './002_seed_user_session_defaults';
import { migration as m003 } from './003_commission_payments_backfill';
import { migration as m004 } from './004_commission_builder_name';
import { migration as m005 } from './005_deal_payments_init';
import { migration as m006 } from './006_commission_splits_init';
import { migration as m007 } from './007_company_plan_features';
import { migration as m008 } from './008_client_owned_by';
import { migration as m009 } from './009_property_project_deal_fields';
import { migration as m010 } from './010_property_owner_phones';
import { migration as m011 } from './011_broker_requirements_init';
import { migration as m012 } from './012_projects_init';
import { migration as m013 } from './013_user_permissions';
import { migration as m014 } from './014_reference_projects_init';
import { migration as m015 } from './015_learn_grow_init';
import { migration as m016 } from './016_feedback_init';

export const ALL_MIGRATIONS: Migration[] = [
  m000,
  m001,
  m002,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009,
  m010,
  m011,
  m012,
  m013,
  m014,
  m015,
  m016,
];
