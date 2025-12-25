import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

export default function FeedbackButtons({ suggestion, onFeedback }) {
  const [showDetails, setShowDetails] = useState(false);
  const [comment, setComment] = useState('');
  const feedback = suggestion.feedback || {};

  const handleThumbsFeedback = (helpful) => {
    onFeedback(suggestion.id, { helpful });
    if (!helpful) {
      setShowDetails(true);
    }
  };

  const handleDetailedFeedback = (rating) => {
    onFeedback(suggestion.id, { 
      helpful: feedback.helpful,
      rating, 
      comment 
    });
    setShowDetails(false);
    setComment('');
  };

  return (
    <div className="border-t pt-3 mt-3">
      <p className="text-xs text-slate-500 mb-2">Was this suggestion helpful?</p>
      
      <div className="flex gap-2">
        <Button
          variant={feedback.helpful === true ? "default" : "outline"}
          size="sm"
          onClick={() => handleThumbsFeedback(true)}
          className={feedback.helpful === true ? "bg-green-600" : ""}
        >
          <ThumbsUp className="w-3 h-3 mr-1" />
          Helpful
        </Button>
        <Button
          variant={feedback.helpful === false ? "default" : "outline"}
          size="sm"
          onClick={() => handleThumbsFeedback(false)}
          className={feedback.helpful === false ? "bg-red-600" : ""}
        >
          <ThumbsDown className="w-3 h-3 mr-1" />
          Not Helpful
        </Button>
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2"
          >
            <p className="text-xs text-slate-600">Help us improve:</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDetailedFeedback('not_helpful')}
              >
                Not Helpful
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDetailedFeedback('confusing')}
              >
                <AlertCircle className="w-3 h-3 mr-1" />
                Confusing
              </Button>
            </div>
            <Textarea
              placeholder="Optional: Tell us more..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="text-xs"
              rows={2}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {feedback.rating && (
        <p className="text-xs text-slate-500 mt-2">
          ✓ Feedback recorded: {feedback.rating.replace('_', ' ')}
        </p>
      )}
    </div>
  );
}