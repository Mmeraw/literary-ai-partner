import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { History, Eye, RotateCcw, Clock, Upload, Sparkles, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";

const triggerIcons = {
  upload: Upload,
  revision_commit: FileText,
  restore: RotateCcw,
  trusted_path: Sparkles
};

const triggerColors = {
  upload: 'bg-blue-100 text-blue-800',
  revision_commit: 'bg-green-100 text-green-800',
  restore: 'bg-amber-100 text-amber-800',
  trusted_path: 'bg-purple-100 text-purple-800'
};

export default function VersionHistory({ session, onRestore }) {
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const versionHistory = session?.version_history || [];
  
  // Current version is always at top (not in history yet)
  const currentVersion = {
    version_id: 'current',
    timestamp: new Date().toISOString(),
    trigger: 'revision_commit',
    snapshot_text: session?.current_text,
    accepted_count: session?.suggestions?.filter(s => s.status === 'accepted').length || 0,
    rejected_count: session?.suggestions?.filter(s => s.status === 'rejected').length || 0,
    label: 'Current Working Version',
    isCurrent: true
  };

  const allVersions = [currentVersion, ...versionHistory];

  const handleRestore = async (version) => {
    setShowRestoreConfirm(false);
    setOpen(false);
    await onRestore(version);
  };

  const handleViewVersion = (version) => {
    setSelectedVersion(version);
    setShowPreview(true);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <History className="w-4 h-4" />
        Version History ({versionHistory.length})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              All revisions are preserved as immutable snapshots. Restoring creates a new working version.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {allVersions.map((version, idx) => {
                const Icon = triggerIcons[version.trigger] || FileText;
                const isCurrent = version.isCurrent;
                
                return (
                  <Card 
                    key={version.version_id}
                    className={isCurrent ? 'border-2 border-indigo-400 bg-indigo-50/50' : ''}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {isCurrent && (
                              <Badge className="bg-indigo-600 text-white">Current</Badge>
                            )}
                            <Badge className={triggerColors[version.trigger]}>
                              <Icon className="w-3 h-3 mr-1" />
                              {version.label || version.trigger.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(version.timestamp), 'MMM d, yyyy h:mm a')}
                            </span>
                            {version.accepted_count !== undefined && (
                              <span className="text-green-600">
                                ✓ {version.accepted_count} accepted
                              </span>
                            )}
                            {version.rejected_count !== undefined && (
                              <span className="text-red-600">
                                ✗ {version.rejected_count} rejected
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500">
                            Version ID: {version.version_id.substring(0, 8)}...
                          </p>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewVersion(version)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                          
                          {!isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedVersion(version);
                                setShowRestoreConfirm(true);
                              }}
                              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedVersion?.label || 'Version Preview'}
            </DialogTitle>
            <DialogDescription>
              {selectedVersion && format(new Date(selectedVersion.timestamp), 'MMMM d, yyyy h:mm a')}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[500px]">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <pre className="whitespace-pre-wrap text-sm font-mono text-slate-800">
                {selectedVersion?.snapshot_text}
              </pre>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore This Version?</DialogTitle>
            <DialogDescription>
              Restoring this version will create a <strong>new working version</strong> based on this snapshot.
              <br /><br />
              <strong className="text-amber-600">Your current work will be preserved</strong> in version history.
              Nothing is deleted or overwritten.
            </DialogDescription>
          </DialogHeader>

          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4">
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={triggerColors[selectedVersion?.trigger || 'upload']}>
                    {selectedVersion?.label}
                  </Badge>
                </div>
                <p className="text-slate-600">
                  {selectedVersion && format(new Date(selectedVersion.timestamp), 'MMMM d, yyyy h:mm a')}
                </p>
                <p className="text-slate-600">
                  {selectedVersion?.accepted_count || 0} accepted, {selectedVersion?.rejected_count || 0} rejected
                </p>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleRestore(selectedVersion)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Create New Version from This Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}