import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export default function StorygateStudioFAQ() {
    const faqs = [
        {
            question: "What is Storygate Studio?",
            answer: "Storygate Studio is a selective professional gateway for narrative projects that have already demonstrated strong readiness."
        },
        {
            question: "What materials are required for manuscript submissions?",
            answer: `Manuscript submissions require:
• A query letter (including a clear pitch / hook paragraph)
• A synopsis
• An author bio

The pitch is part of the query letter, not a separate document.`
        },
        {
            question: "Why does Storygate treat the pitch as part of the query letter?",
            answer: `In traditional publishing, the pitch is not a separate document. It is the opening hook paragraph inside the query letter—the section that quickly communicates what the book is, why it's compelling, and why it belongs in the market.

Storygate Studio follows this industry standard.

For manuscript submissions:
• You do not upload a separate pitch document.
• Your query letter must include a clear, compelling pitch paragraph.
• This is exactly where agents expect to find it.

Internally, Storygate may evaluate:
1. Pitch (the hook inside the query)
2. Synopsis
3. Author bio
4. The full query letter

But for applicants, this remains a single, standard query letter—formatted and structured according to professional agent norms.

Storygate enforces this approach to keep submissions aligned with real-world publishing expectations and to avoid unnecessary or redundant materials.`
        },
        {
            question: "Why is the order Pitch → Synopsis → Bio → Query important?",
            answer: `This reflects how agents assess submissions:
• Pitch first (inside the query)
• Then story understanding (synopsis)
• Then author context (bio)
• Then the full professional letter (query)

Storygate enforces this structure to match industry norms. Pitch refers to the hook paragraph inside the query letter, not a separate upload.`
        },
        {
            question: "Is a Film / TV Pitch Deck required?",
            answer: "Yes. All Screen / Adaptation submissions require a Film / TV Pitch Deck. Projects without a deck cannot advance to human review."
        },
        {
            question: "What is \"Source Material\"?",
            answer: "Source Material is the underlying work being adapted (such as a novel manuscript, series bible, or article). It does not replace the Film / TV Pitch Deck."
        },
        {
            question: "Will I receive feedback if my submission is declined?",
            answer: "Auto-declined submissions may receive brief, structured feedback derived from existing evaluation data. We do not provide bespoke critique."
        },
        {
            question: "Do I need to keep paying to stay in Storygate Studio?",
            answer: `No.

            Once your project is submitted to Storygate Studio, it remains eligible for consideration regardless of whether you maintain a paid subscription (until you remove it).

            Subscriptions apply to evaluation and development tools (such as RevisionGrade, revisions, or Film/TV deck creation). They do not apply to waiting, being considered, or remaining in the Storygate Studio queue.

            You may downgrade your plan or cancel entirely after submitting. Your Storygate Studio submission will remain on file and may still be reviewed or routed based on the materials already submitted.

            If you later wish to revise your work, update materials, or submit a new version, those actions require paid tools again.`
        },
        {
            question: "Does Storygate guarantee representation or production?",
            answer: "No. Storygate Studio does not guarantee representation, publication, or production."
        }
    ];

    return (
        <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
            <CardHeader>
                <CardTitle style={{ color: '#7A1E1E' }}>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left" style={{ color: '#F2EFEA' }}>
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent style={{ color: '#D4D4D4' }}>
                                <div className="whitespace-pre-line">
                                    {faq.answer}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}