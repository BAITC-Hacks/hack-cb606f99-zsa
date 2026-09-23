import { FeaturePlaceholder } from "@/components/feature-placeholder";

export default function CatalogPage() {
  return (
    <FeaturePlaceholder
      title="Открытый каталог задач"
      description="Все опубликованные задачи остаются доступными, сортируются по рейтингу и фильтруются по теме и уровню готовности."
      owner="Frontend"
      nextSteps={[
        "Создать карточку задачи и состояния загрузки.",
        "Добавить сортировку по рейтингу и фильтры.",
        "Подключить GET /api/tasks после готовности бэкенда.",
      ]}
    />
  );
}
