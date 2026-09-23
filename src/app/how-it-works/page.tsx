import type { Metadata } from "next";
import { HowItWorks } from "@/components/how-it-works";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: "Как это работает",
  description: "Как описать задачу, заполнить карточку и выбрать команду.",
};

export default function HowItWorksPage() {
  return (
    <PageTransition>
      <HowItWorks />
    </PageTransition>
  );
}
