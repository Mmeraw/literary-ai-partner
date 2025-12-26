import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function FeedbackPreferences({ user }) {
    const [preferences, setPreferences] = useState({
        show_detailed_scores: user?.show_detailed_scores ?? true,
        show_wave_details: user?.show_wave_details ?? true,
        show_alternative_suggestions: user?.show_alternative_suggestions ?? true,
        email_on_completion: user?.email_on_completion ?? false,
        brutal_honesty_mode: user?.brutal_honesty_mode ?? true
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await base44.auth.updateMe(preferences);
            toast.success('Preferences saved successfully');
        } catch (error) {
            console.error('Error saving preferences:', error);
            toast.error('Failed to save preferences');
        } finally {
            setIsSaving(false);
        }
    };

    const togglePreference = (key) => {
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    return (
        <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Feedback Preferences</h2>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Settings className="w-5 h-5" />
                        Customize Your Experience
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="detailed-scores">Show Detailed Scores</Label>
                                <p className="text-sm text-slate-500">
                                    Display individual criterion scores in reports
                                </p>
                            </div>
                            <Switch
                                id="detailed-scores"
                                checked={preferences.show_detailed_scores}
                                onCheckedChange={() => togglePreference('show_detailed_scores')}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="wave-details">Show WAVE Details</Label>
                                <p className="text-sm text-slate-500">
                                    Include explanations of WAVE revision items
                                </p>
                            </div>
                            <Switch
                                id="wave-details"
                                checked={preferences.show_wave_details}
                                onCheckedChange={() => togglePreference('show_wave_details')}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="alternatives">Show Alternative Suggestions</Label>
                                <p className="text-sm text-slate-500">
                                    Display multiple revision options when available
                                </p>
                            </div>
                            <Switch
                                id="alternatives"
                                checked={preferences.show_alternative_suggestions}
                                onCheckedChange={() => togglePreference('show_alternative_suggestions')}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="email">Email on Completion</Label>
                                <p className="text-sm text-slate-500">
                                    Receive email when evaluation is complete
                                </p>
                            </div>
                            <Switch
                                id="email"
                                checked={preferences.email_on_completion}
                                onCheckedChange={() => togglePreference('email_on_completion')}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="brutal">Brutal Honesty Mode</Label>
                                <p className="text-sm text-slate-500">
                                    Maximum candor in feedback (recommended)
                                </p>
                            </div>
                            <Switch
                                id="brutal"
                                checked={preferences.brutal_honesty_mode}
                                onCheckedChange={() => togglePreference('brutal_honesty_mode')}
                            />
                        </div>
                    </div>

                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="w-full"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save Preferences'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}