import { EditTask } from "@/components/task-builder";
import { PageTransition } from "@/components/page-transition";
export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publication?: string | string[] }>;
}) {
  const { id } = await params;
  const { publication } = await searchParams;
  return <PageTransition><EditTask key={id} id={id} publicationRetry={publication === "retry"} /></PageTransition>;
}
