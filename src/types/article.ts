export interface Article {
  id: string;
  title: string;
  teaser: string | null;
  body: string | null;
  imageUrl: string | null;
  tags: string[];
  publishedAt: string;
}
