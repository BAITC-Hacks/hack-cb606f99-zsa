import { EditTask } from "@/components/task-builder";
export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publication?: string | string[] }>;
}) {
  const { id } = await params;
  const { publication } = await searchParams;
  return <EditTask key={id} id={id} publicationRetry={publication === "retry"} />;
}
