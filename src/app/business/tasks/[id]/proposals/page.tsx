import { FeaturePlaceholder } from "@/components/feature-placeholder";

export default function BusinessProposalsPage() {
  return (
    <FeaturePlaceholder
      title="Отклики команд"
      description="Бизнес сравнивает предложения и вручную принимает или отклоняет каждое из них."
      owner="Frontend + Backend"
      nextSteps={[
        "Показать идею, план, срок и ссылку каждого предложения.",
        "Добавить явные действия принять и отклонить.",
        "Не реализовывать автоматическое назначение команды.",
      ]}
    />
  );
}
