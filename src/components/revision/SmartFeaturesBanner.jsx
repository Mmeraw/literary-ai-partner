import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, Zap } from 'lucide-react';

export default function SmartFeaturesBanner() {
  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">Smart Revision Tools</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-white/50 border-indigo-300 text-indigo-700">
            <Zap className="w-3 h-3 mr-1" />
            Automated Wave Sequencing
          </Badge>
          <Badge variant="outline" className="bg-white/50 border-indigo-300 text-indigo-700">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Draft Enhancement
          </Badge>
          <Badge variant="outline" className="bg-white/50 border-indigo-300 text-indigo-700">
            <TrendingUp className="w-3 h-3 mr-1" />
            Advanced Revision Insights
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}