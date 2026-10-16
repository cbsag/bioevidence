export type QueryPerspective = {
  label: string;
  query: string;
};

const perspectiveLabels = [
  "Meaning perspective",
  "Patient concern perspective",
  "Outcome perspective",
];

const reformulatedQueriesByTopic: Record<string, string[]> = {
  "181": [
    'What does the term "axonal injury" indicate on my MRI brain report, and is it a matter of concern for my health?',
    "Can you explain what axonal injury means in my brain MRI results and whether I should be worried about it?",
    "How does axonal injury appear on a brain MRI, and what does it suggest about my prognosis?",
  ],
  "187": [
    "What are the potential adverse health effects of consuming genetically modified organisms?",
    "Can you explain why some people believe genetically modified foods are harmful?",
    "What are the risks associated with consuming genetically modified foods?",
  ],
  "190": [
    "Which blood tests are commonly used to indicate the presence of cancer?",
    "Can you tell me what blood tests might suggest I have cancer?",
    "What specific blood test results can be indicative of cancer?",
  ],
  "196": [
    "How does the genetic profile of an individual with familial hypercholesterolemia diverge from that of a healthy individual?",
    "Can you explain the genetic differences between someone with familial hypercholesterolemia and a person without this condition?",
    "What specific genetic variations are associated with familial hypercholesterolemia compared to a healthy person's genotype?",
  ],
  "198": [
    "What impact will the inability of the family to afford treatments have on the child's quality of life in relation to cystic fibrosis?",
    "How might the child's quality of life be affected if the family cannot afford treatments for cystic fibrosis?",
    "What are the potential consequences for the child's quality of life if cystic fibrosis remains untreated due to financial constraints?",
  ],
  "206": [
    "What are the implications of a complex tear affecting the lateral meniscus, and what are the recommended treatment options?",
    "Can you explain what a complex tear in the lateral meniscus entails and how it is typically treated?",
    "What are the treatment strategies for a complex tear involving the lateral meniscus?",
  ],
  "210": [
    "How will the therapeutic intervention for a diabetic foot ulcer complicated by osteomyelitis influence the patient's overall quality of life?",
    "What impact will the treatment of my diabetic foot ulcer with osteomyelitis have on my daily life?",
    "What is the expected effect of the treatment regimen on the prognosis and life quality of a patient with diabetic foot ulcer and osteomyelitis?",
  ],
};

export function getQueryPerspectives(
  topicId: string,
  fallbackQuestion: string,
): QueryPerspective[] {
  const queries = reformulatedQueriesByTopic[topicId] ?? [
    `What does the biomedical question mean: ${fallbackQuestion}`,
    `What should a patient be concerned about: ${fallbackQuestion}`,
    `What does the evidence suggest about outcomes: ${fallbackQuestion}`,
  ];

  return queries.slice(0, 3).map((query, index) => ({
    label: perspectiveLabels[index] ?? `Perspective ${index + 1}`,
    query,
  }));
}
