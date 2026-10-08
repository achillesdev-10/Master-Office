import { redirect } from "next/navigation";

/** `/` — le back-office est la racine de l'application (module 4). */
export default function HomePage() {
  redirect("/admin/dashboard");
}
