import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import FeedbackButtons from './FeedbackButtons';
import ScreenplayText from '@/components/ScreenplayText';

export default function SuggestionCard({ 
  suggestion, 
  onAccept, 
  onReject, 
  onRequestAlternatives,
  onSelectAlternative,
  onFeedback,
  isLoading 
}) {
  const [showContext, setShowContext] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!suggestion) return null;

  // Detect if this is screenplay content
  const isScreenplay = /^(INT\.|EXT\.|INT\/EXT\.)/.test(suggestion.original_text?.trim()) || 
                       /^[A-Z][A-Z\s]+\n/.test(suggestion.original_text?.trim());

  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Badge className="bg-indigo-100 text-indigo-700">
            {suggestion.wave_name}
          </Badge>
          {suggestion.status !== 'pending' && (
            <Badge className={
              suggestion.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }>
              {suggestion.status === 'accepted' ? '✓ Accepted' : '✗ Rejected'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Why Flagged */}
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">Issue Identified</h4>
          <p className="text-sm text-amber-800">{suggestion.why_flagged}</p>
        </div>

        {/* Original Text */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">Original</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContext(!showContext)}
            >
              {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showContext ? 'Less' : 'More'} Context
            </Button>
          </div>
          <div className={`p-4 rounded-lg bg-red-50 border border-red-200 ${showContext ? '' : 'max-h-24 overflow-hidden'}`}>
            {isScreenplay ? (
              <ScreenplayText text={suggestion.original_text} />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{suggestion.original_text}</p>
            )}
          </div>
        </div>

        {/* Suggested Revision */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Suggested Revision</h4>
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            {isScreenplay ? (
              <ScreenplayText text={suggestion.suggested_text} />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{suggestion.suggested_text}</p>
            )}
          </div>
        </div>

        {/* Why This Fix */}
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Why This Works</h4>
          <p className="text-sm text-blue-800">{suggestion.why_this_fix}</p>
        </div>

        {/* Alternatives or Fidelity Lock Notice */}
        {suggestion.alternatives === null ? (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-300">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">Single Primary Fix (Fidelity-Locked)</h4>
                <p className="text-sm text-slate-600">
                  {suggestion.alternatives_reason || "No viable alternatives without semantic drift or breaking ritual cadence."}
                </p>
              </div>
            </div>
          </div>
        ) : suggestion.alternatives && suggestion.alternatives.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="mb-2 text-base"
            >
              {showAlternatives ? <ChevronUp className="w-5 h-5 mr-2" /> : <ChevronDown className="w-5 h-5 mr-2" />}
              {suggestion.alternatives.length} Alternative{suggestion.alternatives.length > 1 ? 's' : ''}
            </Button>
            
            <AnimatePresence>
              {showAlternatives && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  {suggestion.alternatives.map((alt, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {isScreenplay ? (
                            <ScreenplayText text={alt} />
                          ) : (
                            <p className="text-sm text-slate-700">{alt}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectAlternative(suggestion.id, alt)}
                          disabled={isLoading}
                        >
                          Use This
                        </Button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        {suggestion.status === 'pending' && (
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => onAccept(suggestion.id)}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Accept
            </Button>
            <Button
              onClick={() => onReject(suggestion.id)}
              disabled={isLoading}
              variant="outline"
              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
            {suggestion.alternatives !== null && (
              <Button
                onClick={() => onRequestAlternatives(suggestion.id)}
                disabled={isLoading || (suggestion.alternatives && suggestion.alternatives.length > 0)}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Alternatives
              </Button>
            )}
          </div>
        )}

        {/* Feedback */}
        {suggestion.status !== 'pending' && (
          <FeedbackButtons suggestion={suggestion} onFeedback={onFeedback} />
        )}
      </CardContent>
    </Card>
  );
}