-- =====================================================================
-- Migration: sync database schema with updated backend routes
-- Run top to bottom, inside a transaction, against a backup/staging
-- copy first. Review the notes inline before running on production.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. AUTH: admins -> users
-- ---------------------------------------------------------------------
-- NOTE: grep your codebase for any remaining references to "admins"
-- before running this rename in production.

ALTER TABLE admins RENAME TO users;
ALTER TABLE users RENAME COLUMN password TO password_hash;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;


-- ---------------------------------------------------------------------
-- 2. CAREERS
-- ---------------------------------------------------------------------

ALTER TABLE careers ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE careers ADD COLUMN IF NOT EXISTS employment_type VARCHAR(100);
ALTER TABLE careers ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE careers ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE careers ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE careers ADD COLUMN IF NOT EXISTS application_email VARCHAR(255);
ALTER TABLE careers ADD COLUMN IF NOT EXISTS application_url TEXT;
ALTER TABLE careers ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE careers ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE careers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- NOTE: decide FK delete behavior before running — CASCADE will delete
-- applications when a career is deleted, SET NULL will orphan them.
CREATE TABLE IF NOT EXISTS career_applications (
  id SERIAL PRIMARY KEY,
  career_id INTEGER REFERENCES careers(id) ON DELETE SET NULL,
  applicant_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  cover_letter TEXT,
  cv_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- 3. INSIGHTS
-- ---------------------------------------------------------------------

ALTER TABLE insights ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE insights ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE insights ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Backfill slug for any existing rows before enforcing uniqueness/NOT NULL.
-- Derives a slug from the title and appends the id to guarantee uniqueness
-- even if two titles are identical. Adjust the slug format if you want
-- something cleaner (e.g. hand-picked slugs) — this just unblocks the
-- NOT NULL/UNIQUE constraints below.
UPDATE insights
SET slug = lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || id
WHERE slug IS NULL OR trim(slug) = '';

ALTER TABLE insights ALTER COLUMN slug SET NOT NULL;
ALTER TABLE insights ADD CONSTRAINT insights_slug_unique UNIQUE (slug);


-- ---------------------------------------------------------------------
-- 4. ADVERTISEMENTS (new table)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS advertisements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  mobile_image_url TEXT,
  button_text VARCHAR(255),
  button_url TEXT,
  position VARCHAR(100) DEFAULT 'homepage',
  display_mode VARCHAR(50) DEFAULT 'banner',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- 5. UPDATES (new table)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS updates (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  author VARCHAR(255),
  seo_title VARCHAR(255),
  seo_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  show_popup BOOLEAN NOT NULL DEFAULT FALSE,
  popup_start_date TIMESTAMP,
  popup_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMIT;