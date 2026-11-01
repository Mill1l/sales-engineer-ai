import type { Metadata } from "next";
import "./globals.css";
import "./selection/selection.css";
import "./selection/ai.css";

export const metadata: Metadata = {
  title: "Sales Engineer AI · 售前选型助手",
  description: "面向智利市场的独立 UPS 售前学习演示，非 Schneider Electric 官方工具。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
