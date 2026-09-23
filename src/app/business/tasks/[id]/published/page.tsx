import { PublishedTask } from "@/components/published-task";
import { PageTransition } from "@/components/page-transition";

export default async function PublishedTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageTransition><PublishedTask key={id} id={id} /></PageTransition>;
}
