// Route: /
// Served via next.config.mjs rewrite → /marketing-export/main/index.html
// This component is never reached in normal operation.
// Safety net redirect if rewrite is ever removed.
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/marketing-export/main/index.html");
}
