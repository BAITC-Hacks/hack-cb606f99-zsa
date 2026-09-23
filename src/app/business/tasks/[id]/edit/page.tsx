import { EditTask } from "@/components/task-builder";
import { PageTransition } from "@/components/page-transition";
export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageTransition><EditTask key={id} id={id} /></PageTransition>;
}
