import type { TaskCard } from "@/shared/contracts";

type TaskCover = {
  id: string;
  title: string;
  theme: string;
  src: string;
  headline?: string;
  description?: string;
};

// Art direction for the examples; other tasks keep their industry cover.
const covers: TaskCover[] = [
  {
    id: "task-1",
    title: "Учёт остатков пекарни",
    theme: "bakery",
    src: "/images/tasks/bakery-inventory.png",
    headline: "План\nвыпечки",
    description: "Остатки и\nпрогноз спроса",
  },
  {
    id: "task-3",
    title: "Очередь в сервисном центре",
    theme: "queue",
    src: "/images/tasks/service-queue-people.png",
    headline: "Всё\nпо очереди",
    description: "Запись и\nстатус ремонта",
  },
  {
    id: "task-5",
    title: "Помощник волонтёров",
    theme: "volunteers",
    src: "/images/tasks/volunteer-assistant.png",
  },
];

export function taskCover(task: Pick<TaskCard, "id" | "title">) {
  const title = task.title.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  return covers.find(
    (cover) => cover.id === task.id ||
      cover.title.toLocaleLowerCase("ru").replaceAll("ё", "е") === title,
  );
}
