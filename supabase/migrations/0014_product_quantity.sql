-- 0014_product_quantity.sql
-- Adds the product's weight/volume specification (e.g. "250 g", "500 ml",
-- "3 x 100 g"), extracted best-effort during scraping (see scrape-product's
-- extractQuantity) or from Open Food Facts's "quantity" field, and editable
-- by hand in the Produkt-Formular like brand/description.
alter table public.products
  add column if not exists quantity text;
