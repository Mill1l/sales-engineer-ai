import { CatalogWorkspace } from "@/components/catalog-workspace";
import { getCatalog } from "@/lib/catalog";

export default function Home() {
  return <CatalogWorkspace catalog={getCatalog()} />;
}
