import { TaskDetails } from "@/components/task-details";
export default async function TaskDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TaskDetails key={id} id={id} />;
}
