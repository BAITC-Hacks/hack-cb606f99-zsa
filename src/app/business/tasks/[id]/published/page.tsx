import { PublishedTask } from "@/components/published-task";

export default async function PublishedTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublishedTask key={id} id={id} />;
}
