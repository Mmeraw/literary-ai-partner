import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, Zap, Shield } from 'lucide-react';

export default function SmartFeaturesBanner({ trustedPathZone }) {
  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-900">Smart Revision Tools</span>
          </div>
          {trustedPathZone && (
            <Badge className={`${
              trustedPathZone.zone === 'failure' ? 'bg-red-100 text-red-800 border-red-200' :
              trustedPathZone.zone === 'conditional' ? 'bg-amber-100 text-amber-800 border-amber-200' :
              'bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}>
              <Shield className="w-3 h-3 mr-1" />
              {trustedPathZone.label}
            </Badge>
          )}
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
        {trustedPathZone && trustedPathZone.zone !== 'full' && (
          <p className={`text-xs mt-2 ${
            trustedPathZone.zone === 'failure' ? 'text-red-700' : 'text-amber-700'
          }`}>
            {trustedPathZone.zone === 'failure' 
              ? 'Trusted Path will focus on structural diagnosis and repair guidance.'
              : 'Trusted Path will guide rebuild with limited polish in stable segments.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}