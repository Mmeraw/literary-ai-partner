import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, ExternalLink, BookOpen } from 'lucide-react';

export default function FindAgents() {
    const [genre, setGenre] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Users className="w-4 h-4 mr-2" />
                        Agent Finder
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Find Literary Agents
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Search for agents accepting submissions in your genre. Filter by #MSWL, recent sales, and representation focus.
                    </p>
                </div>

                {/* Search Interface */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Search Criteria</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Genre</label>
                                <Select value={genre} onValueChange={setGenre}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select genre..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="thriller">Thriller</SelectItem>
                                        <SelectItem value="mystery">Mystery</SelectItem>
                                        <SelectItem value="literary">Literary Fiction</SelectItem>
                                        <SelectItem value="romance">Romance</SelectItem>
                                        <SelectItem value="fantasy">Fantasy</SelectItem>
                                        <SelectItem value="sci-fi">Science Fiction</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Keyword Search</label>
                                <Input
                                    placeholder="Agent name, agency, or #MSWL term..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button className="w-full">
                            <Search className="w-4 h-4 mr-2" />
                            Search Agents
                        </Button>
                    </CardContent>
                </Card>

                {/* Resources */}
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-2 hover:border-indigo-200 transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                QueryTracker
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-4">
                                Comprehensive database of literary agents with query stats, response times, and submission guidelines.
                            </p>
                            <Button variant="outline" className="w-full" asChild>
                                <a href="https://querytracker.net" target="_blank" rel="noopener noreferrer">
                                    Visit QueryTracker
                                    <ExternalLink className="w-4 h-4 ml-2" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-2 hover:border-indigo-200 transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" />
                                Manuscript Wish List
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-4">
                                Browse agents' #MSWL to find those actively seeking stories like yours.
                            </p>
                            <Button variant="outline" className="w-full" asChild>
                                <a href="https://www.manuscriptwishlist.com" target="_blank" rel="noopener noreferrer">
                                    Visit MSWL
                                    <ExternalLink className="w-4 h-4 ml-2" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Coming Soon */}
                <div className="mt-8 p-6 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 text-center">
                        <strong>Coming in Q1:</strong> Integrated agent search with QueryTracker data, MSWL matching, and submission tracking.
                    </p>
                </div>
            </div>
        </div>
    );
}