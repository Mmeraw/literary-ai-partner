import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Star, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export function StarRating({ onRate, label = "Rate this output" }) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    const handleRate = (value) => {
        setRating(value);
        setSubmitted(true);
        onRate(value);
        toast.success('Thanks for your feedback!');
    };

    if (submitted) {
        return (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Star className="w-4 h-4 fill-current" />
                <span>Rated {rating}/5 - Thank you!</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{label}:</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                    <button
                        key={value}
                        onClick={() => handleRate(value)}
                        onMouseEnter={() => setHover(value)}
                        onMouseLeave={() => setHover(0)}
                        className="transition-transform hover:scale-110"
                    >
                        <Star
                            className={cn(
                                "w-5 h-5 transition-colors",
                                (hover >= value || rating >= value)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-slate-300"
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ThumbsFeedback({ onFeedback, label = "Was this helpful?" }) {
    const [feedback, setFeedback] = useState(null);

    const handleFeedback = (value) => {
        setFeedback(value);
        onFeedback(value);
        toast.success('Thanks for your feedback!');
    };

    if (feedback !== null) {
        return (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
                {feedback === 'up' ? (
                    <ThumbsUp className="w-4 h-4" />
                ) : (
                    <ThumbsDown className="w-4 h-4" />
                )}
                <span>Feedback received - Thank you!</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{label}</span>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback('up')}
                    className="hover:bg-emerald-50 hover:text-emerald-600"
                >
                    <ThumbsUp className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback('down')}
                    className="hover:bg-red-50 hover:text-red-600"
                >
                    <ThumbsDown className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export function CanonAccuracyCheck({ onReport }) {
    const [reported, setReported] = useState(false);

    const handleReport = () => {
        setReported(true);
        onReport();
        toast.success('Report submitted - we\'ll review this output');
    };

    if (reported) {
        return (
            <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span>Report submitted - Thank you!</span>
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleReport}
            className="text-slate-500 hover:text-amber-600"
        >
            <AlertCircle className="w-4 h-4 mr-2" />
            Report Canon Violation
        </Button>
    );
}