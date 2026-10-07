import { config } from 'dotenv';
import { resolve } from 'node:path';

// Tests always run against the dedicated test database unless CI provides one.
config({ path: resolve(__dirname, '../.env.test'), override: false, quiet: true });
