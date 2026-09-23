import { FeaturePlaceholder } from "@/components/feature-placeholder";

export default function NewBusinessTaskPage() {
  return (
    <FeaturePlaceholder
      title="Конструктор бизнес-задачи"
      description="Здесь появится мастер из черновика, AI-уточнений, редактируемой карточки и ручного подтверждения."
      owner="Frontend + Backend"
      nextSteps={[
        "Собрать пошаговую форму на общих Zod-контрактах.",
        "Подключить API анализа черновика и генерации карточки.",
        "Показывать прозрачную разбивку рейтинга до публикации.",
      ]}
    />
  );
}
