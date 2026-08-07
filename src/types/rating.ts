export interface Rating {
  id: string;
  productId: string;
  userId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}
