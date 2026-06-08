/* TEMP — load env the way Next does: .env first, then .env.local overrides. Delete after QA. */
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
config({ path: '.env.local', override: true, quiet: true });
