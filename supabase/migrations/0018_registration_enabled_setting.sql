-- 0018_registration_enabled_setting.sql
--
-- Lets an admin disable new user registration from the Admin screen
-- (Nutzerverwaltung) without a deploy — RegisterScreen reads this and
-- shows a maintenance message instead of the signup form when off. Same
-- singleton row / write-lockdown pattern as sitemap_auto_check_enabled,
-- see migration 0012's comments.
alter table public.automation_settings
  add column if not exists registration_enabled boolean not null default true;
