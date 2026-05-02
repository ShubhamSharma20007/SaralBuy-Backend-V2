import path from 'path';
import dotenv from 'dotenv';

const NODE_ENV = process.env.NODE_ENV || 'local';

const envFile = {
  production: '.env.production',
  local: '.env.local',
}[NODE_ENV];

const result = dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

if (result.error) {
  process.exit(1);
}
