import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const steps = [
    { id: 1, label: "Submit Draft", description: "Paste your manuscript" },
    { id: 2, label: "Evaluation", description: "Dual-layer analysis: story structure + line-level craft" },
    { id: 3, label: "Review Suggestions", description: "Accept, reject, or request alternatives" },
    { id: 4, label: "Finalize", description: "Export polished version" }
];

export default function ProgressTracker({ currentStep = 1, isProcessing = false }) {
    return (
        <Card className="border-0 shadow-sm bg-white/60 backdrop-blur-sm">
            <CardContent className="py-6">
                <div className="flex items-center justify-between">
                    {steps.map((step, idx) => (
                        <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        scale: currentStep === step.id ? 1.1 : 1
                                    }}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                                        currentStep > step.id && "bg-emerald-500 text-white",
                                        currentStep === step.id && isProcessing && "bg-indigo-500 text-white",
                                        currentStep === step.id && !isProcessing && "bg-indigo-600 text-white ring-4 ring-indigo-100",
                                        currentStep < step.id && "bg-slate-100 text-slate-400"
                                    )}
                                >
                                    {currentStep > step.id ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : currentStep === step.id && isProcessing ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <span className="text-sm font-semibold">{step.id}</span>
                                    )}
                                </motion.div>
                                <div className="mt-3 text-center">
                                    <p className={cn(
                                        "text-sm font-medium",
                                        currentStep >= step.id ? "text-slate-800" : "text-slate-400"
                                    )}>
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className="flex-1 mx-4 hidden sm:block">
                                    <div className={cn(
                                        "h-0.5 rounded-full transition-all duration-500",
                                        currentStep > step.id ? "bg-emerald-500" : "bg-slate-200"
                                    )} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}