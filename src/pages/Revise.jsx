import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Download, Save, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import SuggestionCard from '@/components/revision/SuggestionCard';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Revise() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ['revisionSession', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const sessions = await base44.entities.RevisionSession.filter({ id: sessionId });
      return sessions[0] || null;
    },
    enabled: !!sessionId
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }) => base44.entities.RevisionSession.update(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisionSession', sessionId] });
    }
  });

  const handleAccept = async (suggestionId) => {
    const suggestion = session.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    // Apply the change to current_text
    const updatedText = session.current_text.replace(
      suggestion.original_text,
      suggestion.suggested_text
    );

    const updatedSuggestions = session.suggestions.map(s =>
      s.id === suggestionId ? { ...s, status: 'accepted' } : s
    );

    await updateSessionMutation.mutateAsync({
      sessionId: session.id,
      data: {
        current_text: updatedText,
        suggestions: updatedSuggestions
      }
    });

    toast.success('Change accepted');
  };

  const handleReject = async (suggestionId) => {
    const updatedSuggestions = session.suggestions.map(s =>
      s.id === suggestionId ? { ...s, status: 'rejected' } : s
    );

    await updateSessionMutation.mutateAsync({
      sessionId: session.id,
      data: { suggestions: updatedSuggestions }
    });

    toast.success('Change rejected');
  };

  const handleRequestAlternatives = async (suggestionId) => {
    const suggestion = session.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    try {
      const { data } = await base44.functions.invoke('generateAlternatives', {
        original_text: suggestion.original_text,
        current_suggestion: suggestion.suggested_text,
        why_flagged: suggestion.why_flagged,
        why_this_fix: suggestion.why_this_fix
      });

      const updatedSuggestions = session.suggestions.map(s =>
        s.id === suggestionId ? { ...s, alternatives: data.alternatives } : s
      );

      await updateSessionMutation.mutateAsync({
        sessionId: session.id,
        data: { suggestions: updatedSuggestions }
      });

      toast.success('Alternatives generated');
    } catch (error) {
      toast.error('Failed to generate alternatives');
    }
  };

  const handleSelectAlternative = async (suggestionId, alternativeText) => {
    const suggestion = session.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const updatedText = session.current_text.replace(
      suggestion.original_text,
      alternativeText
    );

    const updatedSuggestions = session.suggestions.map(s =>
      s.id === suggestionId ? { ...s, suggested_text: alternativeText, status: 'accepted' } : s
    );

    await updateSessionMutation.mutateAsync({
      sessionId: session.id,
      data: {
        current_text: updatedText,
        suggestions: updatedSuggestions
      }
    });

    toast.success('Alternative applied');
  };

  const handleNavigate = async (direction) => {
    const newPosition = direction === 'next' 
      ? Math.min(session.current_position + 1, session.suggestions.length - 1)
      : Math.max(session.current_position - 1, 0);

    await updateSessionMutation.mutateAsync({
      sessionId: session.id,
      data: { current_position: newPosition }
    });
  };

  const handleSaveAndExit = async () => {
    await updateSessionMutation.mutateAsync({
      sessionId: session.id,
      data: { status: 'paused' }
    });
    toast.success('Progress saved');
    window.location.href = createPageUrl('History');
  };

  const handleDownload = () => {
    const blob = new Blob([session.current_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title}_revision.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded current revision');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-600">Revision session not found</p>
            <Link to={createPageUrl('History')}>
              <Button className="mt-4">Back to History</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSuggestion = session.suggestions[session.current_position];
  const progress = ((session.current_position + 1) / session.suggestions.length) * 100;
  const acceptedCount = session.suggestions.filter(s => s.status === 'accepted').length;
  const rejectedCount = session.suggestions.filter(s => s.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl('History')}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to History
            </Button>
          </Link>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{session.title}</h1>
              <p className="text-slate-600 mt-1">Wave-by-Wave Revision</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={handleSaveAndExit}>
                <Save className="w-4 h-4 mr-2" />
                Save & Exit
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Suggestion {session.current_position + 1} of {session.suggestions.length}
                </span>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">✓ {acceptedCount} accepted</span>
                  <span className="text-red-600">✗ {rejectedCount} rejected</span>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Current Suggestion */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSuggestion?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <SuggestionCard
              suggestion={currentSuggestion}
              onAccept={handleAccept}
              onReject={handleReject}
              onRequestAlternatives={handleRequestAlternatives}
              onSelectAlternative={handleSelectAlternative}
              isLoading={updateSessionMutation.isPending}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => handleNavigate('prev')}
            disabled={session.current_position === 0 || updateSessionMutation.isPending}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => handleNavigate('next')}
            disabled={session.current_position >= session.suggestions.length - 1 || updateSessionMutation.isPending}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}