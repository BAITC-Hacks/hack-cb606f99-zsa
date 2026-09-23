import { TaskBuilder } from "@/components/task-builder";
import { PageTransition } from "@/components/page-transition";
export default function NewTaskPage() {
  return <PageTransition><TaskBuilder /></PageTransition>;
}
