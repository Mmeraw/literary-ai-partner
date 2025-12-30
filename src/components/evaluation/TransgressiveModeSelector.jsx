import React, { useState } from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export default function TransgressiveModeSelector({ value, onChange }) {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [intentConfirmed, setIntentConfirmed] = useState(false);
    const [pendingMode, setPendingMode] = useState(null);

    const handleModeChange = (newMode) => {
        if (newMode === 'transgressive' || newMode === 'trauma_memoir') {
            setPendingMode(newMode);
            setShowConfirmModal(true);
        } else {
            onChange(newMode);
        }
    };

    const handleConfirm = () => {
        if (intentConfirmed) {
            onChange(pendingMode);
            setShowConfirmModal(false);
            setIntentConfirmed(false);
            setPendingMode(null);
        }
    };

    const handleCancel = () => {
        setShowConfirmModal(false);
        setIntentConfirmed(false);
        setPendingMode(null);
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Evaluation Mode</label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p className="text-sm">
                                    Choose how we interpret extreme or confrontational material. 
                                    Standard evaluates agent-readiness. Transgressive evaluates craft 
                                    effectiveness without moral filtering.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <RadioGroup value={value} onValueChange={handleModeChange} className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard" className="flex-1 cursor-pointer">
                            <div className="font-medium">Standard (agent-ready defaults)</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Evaluates for mainstream commercial fiction and literary standards
                            </div>
                        </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-purple-200 hover:border-purple-400 hover:bg-purple-50/30 transition-all">
                        <RadioGroupItem value="transgressive" id="transgressive" />
                        <Label htmlFor="transgressive" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Transgressive (craft, not comfort)</span>
                                <Badge variant="outline" className="text-xs">Dark Fiction</Badge>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Evaluates effectiveness, control, and intent. No sanitization.
                            </div>
                        </Label>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-4 h-4 text-purple-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                    <p className="text-sm">
                                        <strong>Transgressive Mode</strong> evaluates effectiveness, control, and intent. 
                                        It does not try to soften your voice. You'll still get market and platform 
                                        risk notes as a separate panel.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-amber-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all">
                        <RadioGroupItem value="trauma_memoir" id="trauma_memoir" />
                        <Label htmlFor="trauma_memoir" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Trauma Memoir (survivor testimony)</span>
                                <Badge variant="outline" className="text-xs">Non-Fiction</Badge>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Respects psychological accuracy and embodied truth. Preserves authentic voice.
                            </div>
                        </Label>
                    </div>
                </RadioGroup>

                {(value === 'transgressive' || value === 'trauma_memoir') && (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-purple-900">
                                {value === 'transgressive' ? (
                                    <>
                                        <strong>Transgressive Mode Active:</strong> This mode evaluates craft, not comfort. 
                                        Content may be disturbing. We evaluate precision and control, not appropriateness.
                                    </>
                                ) : (
                                    <>
                                        <strong>Trauma Memoir Mode Active:</strong> Content is treated as survivor testimony. 
                                        We respect embodied truth and psychological accuracy without suggesting tone-down.
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {pendingMode === 'transgressive' ? 'Confirm Transgressive Mode' : 'Confirm Trauma Memoir Mode'}
                        </DialogTitle>
                        <DialogDescription className="space-y-3 pt-2">
                            {pendingMode === 'transgressive' ? (
                                <>
                                    <p>
                                        You're asking for feedback focused on <strong>craft effectiveness</strong>, not reader comfort. 
                                        Some language and themes may be evaluated for precision and impact without being toned down.
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        This mode is designed for transgressive fiction, dark realism, horror, and extreme noir. 
                                        We evaluate control, psychological truth, and thematic function—not moral alignment.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        You're indicating this is <strong>survivor testimony</strong>. We will evaluate 
                                        authenticity, coherence, and psychological accuracy without suggesting you tone down 
                                        difficult content.
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        This mode respects embodied truth and sensory detail. We flag only exploitation 
                                        framing, invented details, or breaks in psychological truth.
                                    </p>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-start space-x-2 py-4">
                        <Checkbox 
                            id="intent-confirm" 
                            checked={intentConfirmed}
                            onCheckedChange={setIntentConfirmed}
                        />
                        <Label htmlFor="intent-confirm" className="text-sm cursor-pointer leading-relaxed">
                            {pendingMode === 'transgressive' 
                                ? 'I intend this work to be transgressive/dark and I want craft-focused feedback.'
                                : 'This is survivor testimony and I want feedback that respects psychological truth.'}
                        </Label>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleConfirm} 
                            disabled={!intentConfirmed}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}