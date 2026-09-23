import { EditTask } from "@/components/task-builder";
export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditTask key={id} id={id} />;
}
