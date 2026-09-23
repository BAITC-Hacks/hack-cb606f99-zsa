import { Proposals } from "@/components/proposals";
export default async function ProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Proposals key={id} id={id} />;
}
