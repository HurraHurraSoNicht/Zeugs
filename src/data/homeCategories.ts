export interface HomeCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

// Categories from the honeycomb navigation scribble. Tapping a tile
// navigates to the Discover tab filtered to that category's id (see
// HomeScreen/DiscoverScreen) — 'all' means no filter.
export const HOME_CATEGORIES: HomeCategory[] = [
  { id: 'all', label: 'Alle Produkte', emoji: '🛒', color: '#FBEFC7' },
  { id: 'chilled-frozen', label: 'Gekühlt & Tiefgekühlt', emoji: '❄️', color: '#D6EAF8' },
  { id: 'ready-meals', label: 'Fertiggerichte & Convenience', emoji: '🍱', color: '#FBE2C4' },
  { id: 'baked-goods', label: 'Backwaren & Kuchen', emoji: '🥐', color: '#F9D9E0' },
  { id: 'pantry', label: 'Vorratsschrank', emoji: '🥫', color: '#DDEEDD' },
  { id: 'fine-food', label: 'Fein(ste)-Kost', emoji: '🧀', color: '#F0DFC8' },
  { id: 'coffee-tea-cereal', label: 'Kaffee, Tee und Cerealien', emoji: '☕', color: '#F5EAD6' },
  { id: 'spices-sauces', label: 'Gewürze und Saucen', emoji: '🌶️', color: '#E6DFF2' },
  { id: 'sweets', label: 'Süßes und Kekse', emoji: '🍫', color: '#F9D9E0' },
  { id: 'snacks', label: 'Knabbereien & Chips', emoji: '🍟', color: '#FBF0C4' },
  { id: 'soft-drinks', label: 'Softdrinks & Nullprozentiges', emoji: '🥤', color: '#DCEEFB' },
];
