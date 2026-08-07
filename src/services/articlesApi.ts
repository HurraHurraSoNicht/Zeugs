import { extractFunctionError, getSupabase } from './supabaseClient';
import type { Article } from '../types/article';

interface ArticleRow {
  id: string;
  title: string;
  teaser: string | null;
  body: string | null;
  image_url: string | null;
  tags: string[] | null;
  published_at: string;
}

function rowToArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    teaser: row.teaser,
    body: row.body,
    imageUrl: row.image_url,
    tags: row.tags ?? [],
    publishedAt: row.published_at,
  };
}

// Reads are publicly allowed by RLS (see supabase/migrations/0006_articles.sql),
// so this goes straight to the table with the anon key.
export async function fetchArticles(): Promise<Article[]> {
  const { data, error } = await getSupabase()
    .from('articles')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data as ArticleRow[]).map(rowToArticle);
}

// Writes go through the admin-articles Edge Function (service role key) —
// RLS blocks inserts/updates/deletes for the anon key on purpose, see that
// migration's comments and the admin-articles function's header.
export async function insertArticle(article: Article): Promise<Article> {
  const { data, error } = await getSupabase().functions.invoke('admin-articles', {
    body: {
      title: article.title,
      teaser: article.teaser,
      body: article.body,
      imageUrl: article.imageUrl,
      tags: article.tags,
    },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  return data as Article;
}

export async function updateArticle(id: string, article: Article): Promise<Article> {
  const { data, error } = await getSupabase().functions.invoke('admin-articles', {
    method: 'PUT',
    body: {
      id,
      title: article.title,
      teaser: article.teaser,
      body: article.body,
      imageUrl: article.imageUrl,
      tags: article.tags,
    },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  return data as Article;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('admin-articles', {
    method: 'DELETE',
    body: { id },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
}
