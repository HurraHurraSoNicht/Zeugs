import type { NutritionFacts } from './nutrition';

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  description: string | null;
  imageUrl: string | null;
  source: string | null;
  sourceUrl: string | null;
  category: string | null;
  discoveredAt: string;
  averageRating: number;
  ratingsCount: number;
  tags: string[];
  categories: string[];
  nutrition: NutritionFacts | null;
}
