import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, Check } from 'lucide-react';

export default function OverallFeedbackModal({ open, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [helpfulAspects, setHelpfulAspects] = useState([]);
  const [improvementAreas, setImprovementAreas] = useState([]);
  const [comment, setComment] = useState('');

  const helpfulOptions = [
    'Clear explanations',
    'Specific suggestions',
    'Alternative options',
    'Wave progression',
    'Editorial rationale'
  ];

  const improvementOptions = [
    'Too many suggestions',
    'Suggestions too broad',
    'Explanations unclear',
    'Navigation confusing',
    'Missing context'
  ];

  const toggleOption = (option, list, setter) => {
    if (list.includes(option)) {
      setter(list.filter(o => o !== option));
    } else {
      setter([...list, option]);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      rating,
      helpful_aspects: helpfulAspects,
      improvement_areas: improvementAreas,
      comment
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How was the revision experience?</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div>
            <p className="text-sm font-medium mb-2">Overall Rating</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-all"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating 
                        ? 'fill-amber-400 text-amber-400' 
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* What was helpful */}
          <div>
            <p className="text-sm font-medium mb-2">What was helpful?</p>
            <div className="flex flex-wrap gap-2">
              {helpfulOptions.map((option) => (
                <Button
                  key={option}
                  variant={helpfulAspects.includes(option) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleOption(option, helpfulAspects, setHelpfulAspects)}
                  className={helpfulAspects.includes(option) ? "bg-green-600" : ""}
                >
                  {helpfulAspects.includes(option) && <Check className="w-3 h-3 mr-1" />}
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* What needs improvement */}
          <div>
            <p className="text-sm font-medium mb-2">What could be improved?</p>
            <div className="flex flex-wrap gap-2">
              {improvementOptions.map((option) => (
                <Button
                  key={option}
                  variant={improvementAreas.includes(option) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleOption(option, improvementAreas, setImprovementAreas)}
                  className={improvementAreas.includes(option) ? "bg-amber-600" : ""}
                >
                  {improvementAreas.includes(option) && <Check className="w-3 h-3 mr-1" />}
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* Additional comments */}
          <div>
            <p className="text-sm font-medium mb-2">Additional feedback (optional)</p>
            <Textarea
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={rating === 0}>
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}