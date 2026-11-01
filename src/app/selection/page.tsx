import type { Metadata } from "next";
import { SelectionWorkspace } from "@/components/selection-workspace";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "询盘与选型 · Sales Engineer AI" };

export default function SelectionPage() {
  return <SelectionWorkspace products={getCatalog().products} />;
}
