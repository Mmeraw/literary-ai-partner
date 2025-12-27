import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Film, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function SelectFormat() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-6">
            <div className="max-w-4xl w-full">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        What are you analyzing?
                    </h1>
                    <p className="text-xl text-slate-600">
                        Choose your format to get started with full structure-aware analysis
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="border-2 border-slate-200 hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer group h-full">
                            <Link to={createPageUrl('UploadManuscript')}>
                                <CardHeader className="pb-4">
                                    <div className="inline-flex p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 group-hover:scale-110 transition-transform">
                                        <BookOpen className="w-8 h-8 text-white" />
                                    </div>
                                    <CardTitle className="text-2xl">Manuscript</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-slate-600 leading-relaxed">
                                        Full novel analysis with spine evaluation, chapter-by-chapter breakdown, 
                                        and comprehensive literary agent criteria assessment.
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-600">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                            Spine evaluation
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                            Chapter analysis
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                            WAVE Revision System
                                        </li>
                                    </ul>
                                    <Button className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                                        Analyze Manuscript
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </CardContent>
                            </Link>
                        </Card>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="border-2 border-slate-200 hover:border-pink-500 hover:shadow-xl transition-all cursor-pointer group h-full">
                            <Link to={createPageUrl('ScreenplayFormatter')}>
                                <CardHeader className="pb-4">
                                    <div className="inline-flex p-4 rounded-xl bg-gradient-to-br from-pink-500 to-orange-600 mb-4 group-hover:scale-110 transition-transform">
                                        <Film className="w-8 h-8 text-white" />
                                    </div>
                                    <CardTitle className="text-2xl">Screenplay</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-slate-600 leading-relaxed">
                                        Professional screenplay formatting and analysis with structure evaluation, 
                                        pacing assessment, and industry-standard criteria.
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-600">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-pink-600" />
                                            Format validation
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-pink-600" />
                                            Structure analysis
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-pink-600" />
                                            Scene evaluation
                                        </li>
                                    </ul>
                                    <Button className="w-full mt-4 bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700">
                                        Analyze Screenplay
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </CardContent>
                            </Link>
                        </Card>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-8"
                >
                    <p className="text-sm text-slate-500">
                        Not sure? Try our <Link to={createPageUrl('Evaluate')} className="text-indigo-600 hover:underline">Quick Evaluation</Link> first
                    </p>
                </motion.div>
            </div>
        </div>
    );
}