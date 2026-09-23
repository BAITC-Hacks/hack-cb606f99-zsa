import { FeaturePlaceholder } from "@/components/feature-placeholder";

export default function TaskDetailsPage() {
  return (
    <FeaturePlaceholder
      title="Карточка задачи"
      description="Студенческая команда видит полное описание задачи и отправляет идею, план, срок и ссылку на прототип."
      owner="Frontend + Backend"
      nextSteps={[
        "Вывести подтверждённые поля карточки и рейтинг.",
        "Добавить форму предложения команды.",
        "Подключить POST /api/tasks/:id/proposals.",
      ]}
    />
  );
}
