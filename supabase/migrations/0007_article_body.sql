-- 0007_article_body.sql
-- Adds the actual article text (as opposed to the short teaser shown on the
-- Snack-e-zine feed) so a full article can be read on its own detail page.
alter table public.articles
  add column if not exists body text;
