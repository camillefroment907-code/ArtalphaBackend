-- HONO Database Initialization
-- Safe to run multiple times (fully idempotent)

-- Enable extensions (all support IF NOT EXISTS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Full-text search configuration
-- CREATE TEXT SEARCH CONFIGURATION does not support IF NOT EXISTS
-- Use a DO block to check existence before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'hono_fts'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION hono_fts (COPY = simple);
    END IF;
END;
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE hono TO postgres;
