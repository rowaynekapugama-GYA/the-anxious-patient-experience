/**
 * Must be the first import of every script run through tsx, so that
 * process.env is populated before payload.config is evaluated.
 */
import { config } from 'dotenv'
import path from 'node:path'

config({ path: path.resolve(process.cwd(), '.env'), quiet: true })
