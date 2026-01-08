import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Play, Download, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";

export default function Phase1ExitTests() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [testResults, setTestResults] = useState({});
    const [runningTests, setRunningTests] = useState({});

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const userData = await base44.auth.me();
                setUser(userData);
            } catch (err) {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const tests = [
        {
            id: 'test1',
            name: 'MatrixPreflight Universal Enforcement',
            function: 'testMatrixPreflightEnforcement',
            description: 'Verifies all 8 endpoints block invalid requests before LLM invocation'
        },
        {
            id: 'test2',
            name: 'Gate Enforcement Integrity',
            function: 'testGateEnforcement',
            description: 'Proves Phase 2 cannot run unless readiness, coverage, and integrity gates pass'
        },
        {
            id: 'test3',
            name: 'Deterministic Run Selection',
            function: 'testRunSelection',
            description: 'Validates UI/API selects most advanced + most recent run'
        },
        {
            id: 'test4',
            name: 'Legacy Bypass Prevention',
            function: 'testLegacyBypass',
            description: 'Ensures no legacy Submission/ManuscriptChapter reads in UI'
        },
        {
            id: 'test5',
            name: 'Audit Completeness',
            function: 'testAuditCompleteness',
            description: 'Validates complete audit envelope across all governed endpoints'
        }
    ];

    const runTest = async (test) => {
        setRunningTests(prev => ({ ...prev, [test.id]: true }));
        
        try {
            const response = await base44.functions.invoke(test.function, {});
            
            setTestResults(prev => ({
                ...prev,
                [test.id]: response.data
            }));

            if (response.data.passed) {
                toast.success(`${test.name} - PASSED`);
            } else {
                toast.error(`${test.name} - FAILED`);
            }
        } catch (error) {
            toast.error(`Test failed: ${error.message}`);
            setTestResults(prev => ({
                ...prev,
                [test.id]: { passed: false, error: error.message }
            }));
        } finally {
            setRunningTests(prev => ({ ...prev, [test.id]: false }));
        }
    };

    const runAllTests = async () => {
        for (const test of tests) {
            await runTest(test);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    };

    const downloadEvidence = () => {
        const evidence = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 1 Exit Tests',
            results: testResults,
            summary: {
                total: tests.length,
                passed: Object.values(testResults).filter(r => r.passed).length,
                failed: Object.values(testResults).filter(r => !r.passed).length,
                pending: tests.length - Object.keys(testResults).length
            }
        };

        const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phase1_exit_evidence_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Evidence downloaded');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600">Admin access required for Phase 1 exit tests.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const allTestsComplete = Object.keys(testResults).length === tests.length;
    const allTestsPassed = allTestsComplete && Object.values(testResults).every(r => r.passed);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12">
            <div className="max-w-6xl mx-auto px-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Phase 1 Exit Tests</h1>
                    <p className="text-slate-600">Runtime Governance Enforcement Verification</p>
                </div>

                {/* Summary Banner */}
                {allTestsComplete && (
                    <div className={`p-6 rounded-xl mb-6 border-2 ${
                        allTestsPassed 
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-rose-50 border-rose-300'
                    }`}>
                        <div className="flex items-center gap-3">
                            {allTestsPassed ? (
                                <>
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                    <div>
                                        <h3 className="font-bold text-emerald-900">All Tests Passed</h3>
                                        <p className="text-sm text-emerald-700">Phase 1 Output Surface Governance is verified and sign-off ready.</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-6 h-6 text-rose-600" />
                                    <div>
                                        <h3 className="font-bold text-rose-900">Tests Failed</h3>
                                        <p className="text-sm text-rose-700">Review failed tests below and address governance gaps.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex gap-3 mb-6">
                    <Button 
                        onClick={runAllTests}
                        disabled={Object.values(runningTests).some(r => r)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Run All Tests
                    </Button>
                    {Object.keys(testResults).length > 0 && (
                        <Button onClick={downloadEvidence} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Download Evidence
                        </Button>
                    )}
                </div>

                {/* Test Cards */}
                <div className="space-y-4">
                    {tests.map(test => {
                        const result = testResults[test.id];
                        const isRunning = runningTests[test.id];

                        return (
                            <Card key={test.id} className="border-2">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <CardTitle className="text-lg">{test.name}</CardTitle>
                                                {result && (
                                                    result.passed ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            PASSED
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-rose-100 text-rose-700">
                                                            <XCircle className="w-3 h-3 mr-1" />
                                                            FAILED
                                                        </Badge>
                                                    )
                                                )}
                                                {isRunning && (
                                                    <Badge className="bg-blue-100 text-blue-700">
                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                        RUNNING
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600">{test.description}</p>
                                        </div>
                                        <Button
                                            onClick={() => runTest(test)}
                                            disabled={isRunning}
                                            size="sm"
                                            variant="outline"
                                        >
                                            {isRunning ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </CardHeader>
                                {result && (
                                    <CardContent>
                                        {result.manualVerificationRequired && (
                                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="font-semibold text-amber-900 mb-1">Manual Verification Required</p>
                                                        <p className="text-sm text-amber-700">{result.instructions?.message}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {result.summary && (
                                            <div className="mb-4 grid grid-cols-3 gap-3">
                                                <div className="p-3 rounded-lg bg-slate-50">
                                                    <p className="text-xs text-slate-600">Total</p>
                                                    <p className="text-xl font-bold text-slate-900">{result.summary.total}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-emerald-50">
                                                    <p className="text-xs text-emerald-700">Passed</p>
                                                    <p className="text-xl font-bold text-emerald-900">{result.summary.passed}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-rose-50">
                                                    <p className="text-xs text-rose-700">Failed</p>
                                                    <p className="text-xl font-bold text-rose-900">{result.summary.failed}</p>
                                                </div>
                                            </div>
                                        )}

                                        <details className="text-sm">
                                            <summary className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium">
                                                View Evidence
                                            </summary>
                                            <pre className="mt-3 p-4 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-xs">
                                                {JSON.stringify(result, null, 2)}
                                            </pre>
                                        </details>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}