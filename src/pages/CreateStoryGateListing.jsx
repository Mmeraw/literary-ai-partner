import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function CreateStoryGateListing() {
    const [selectedManuscript, setSelectedManuscript] = useState('');
    const [formData, setFormData] = useState({
        logline: '',
        synopsis_public: '',
        genre: '',
        stage: 'final',
        materials_available: [],
        contact_enabled: false,
        acknowledgment: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: manuscripts = [], isLoading } = useQuery({
        queryKey: ['finalManuscripts'],
        queryFn: () => base44.entities.Manuscript.filter({ 
            created_by: user.email,
            is_final: true 
        }),
        enabled: !!user
    });

    const handleMaterialToggle = (material) => {
        setFormData(prev => ({
            ...prev,
            materials_available: prev.materials_available.includes(material)
                ? prev.materials_available.filter(m => m !== material)
                : [...prev.materials_available, material]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedManuscript) {
            toast.error('Please select a manuscript');
            return;
        }

        if (!formData.logline.trim() || !formData.genre) {
            toast.error('Logline and genre are required');
            return;
        }

        if (!formData.acknowledgment) {
            toast.error('Please acknowledge the StoryGate terms');
            return;
        }

        setIsSubmitting(true);

        try {
            const manuscript = manuscripts.find(m => m.id === selectedManuscript);
            
            await base44.functions.invoke('createStoryGateListing', {
                manuscript_id: selectedManuscript,
                title: manuscript.title,
                logline: formData.logline,
                synopsis_public: formData.synopsis_public,
                genre: formData.genre,
                stage: formData.stage,
                materials_available: formData.materials_available,
                contact_enabled: formData.contact_enabled
            });

            toast.success('Listing created');
            window.location.href = '/CreatorStoryGate';
        } catch (error) {
            toast.error(error.message || 'Failed to create listing');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Create StoryGate Listing</h1>
                    <p className="text-slate-600">
                        Publish your final manuscript to StoryGate for industry discovery
                    </p>
                </div>

                {/* Compliance Banner */}
                <Card className="mb-6 border-indigo-200 bg-indigo-50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-indigo-900 font-medium mb-1">
                                    StoryGate Listing Disclaimer
                                </p>
                                <p className="text-xs text-indigo-800">
                                    StoryGate is not an agency or broker. Creating a listing does not imply representation, obligation, 
                                    or commercial intent. You control who can access your materials. All access is logged.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Listing Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            </div>
                        ) : manuscripts.length === 0 ? (
                            <div className="text-center py-12">
                                <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <p className="text-slate-600 mb-2">No final manuscripts available</p>
                                <p className="text-sm text-slate-500">
                                    Mark a manuscript as Final in your dashboard to create a StoryGate listing
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Select Final Manuscript *
                                    </label>
                                    <Select value={selectedManuscript} onValueChange={setSelectedManuscript}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose manuscript" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {manuscripts.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.title} ({m.word_count.toLocaleString()} words)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Logline * (1-2 sentences)
                                    </label>
                                    <Textarea
                                        value={formData.logline}
                                        onChange={(e) => setFormData({...formData, logline: e.target.value})}
                                        placeholder="Brief compelling summary of your story"
                                        className="h-24"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Public Synopsis (Optional)
                                    </label>
                                    <Textarea
                                        value={formData.synopsis_public}
                                        onChange={(e) => setFormData({...formData, synopsis_public: e.target.value})}
                                        placeholder="Extended description visible in discovery"
                                        className="h-32"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Genre *
                                    </label>
                                    <Input
                                        value={formData.genre}
                                        onChange={(e) => setFormData({...formData, genre: e.target.value})}
                                        placeholder="e.g., Literary Fiction, Thriller, etc."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Available Materials (Select what to offer)
                                    </label>
                                    <div className="space-y-2">
                                        {['Full manuscript', 'Synopsis', 'Sample chapters', 'Pitch deck'].map(material => (
                                            <label key={material} className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox
                                                    checked={formData.materials_available.includes(material)}
                                                    onCheckedChange={() => handleMaterialToggle(material)}
                                                />
                                                <span className="text-sm text-slate-700">{material}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <Checkbox
                                            checked={formData.acknowledgment}
                                            onCheckedChange={(checked) => setFormData({...formData, acknowledgment: checked})}
                                            required
                                        />
                                        <span className="text-sm text-slate-700">
                                            I understand that StoryGate is not an agency or broker. Creating this listing does not imply 
                                            representation, endorsement, or obligation. I control who can access my materials and can 
                                            revoke access at any time.
                                        </span>
                                    </label>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating Listing...
                                        </>
                                    ) : (
                                        'Create Listing (Private by Default)'
                                    )}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}