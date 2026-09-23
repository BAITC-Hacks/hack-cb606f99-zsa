import { Proposals } from "@/components/proposals";
import { PageTransition } from "@/components/page-transition";
export default async function ProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageTransition><Proposals key={id} id={id} /></PageTransition>;
}
