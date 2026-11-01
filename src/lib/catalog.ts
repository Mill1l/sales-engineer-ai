import data from "@/data/products.json";
import { catalogSchema } from "./catalog-schema";

// Validation fails closed: invalid facts never become implicitly verified.
export function getCatalog() {
  return catalogSchema.parse(data);
}
