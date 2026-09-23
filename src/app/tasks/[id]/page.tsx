import { TaskDetails } from "@/components/task-details";
import { PageTransition } from "@/components/page-transition";
export default async function TaskDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageTransition><TaskDetails key={id} id={id} /></PageTransition>;
}
