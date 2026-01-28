
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, PlusCircle, Trash2, Info } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, set, onValue, get, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type GradeBoundary = {
    id: string;
    grade: string;
    minScore: number;
    maxScore: number;
    gpa: number;
};

type Programme = {
    id: string;
    name: string;
    gradingScale?: Record<string, Omit<GradeBoundary, 'id'>>;
};

export default function GradingSetupPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [selectedProgrammeId, setSelectedProgrammeId] = React.useState('');
    const [gradingScale, setGradingScale] = React.useState<GradeBoundary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const programmesRef = ref(db, 'programmes');
        const unsubscribe = onValue(programmesRef, (snapshot) => {
            if(snapshot.exists()){
                const data = snapshot.val();
                const list: Programme[] = Object.keys(data).map(id => ({id, ...data[id]}));
                setProgrammes(list);
                if (list.length > 0 && !selectedProgrammeId) {
                    setSelectedProgrammeId(list[0].id);
                }
            } else {
                setProgrammes([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [selectedProgrammeId]);

    React.useEffect(() => {
        if (!selectedProgrammeId) {
            setGradingScale([]);
            return;
        }
        const selectedProg = programmes.find(p => p.id === selectedProgrammeId);
        if (selectedProg?.gradingScale) {
             setGradingScale(Object.keys(selectedProg.gradingScale).map(id => ({id, ...selectedProg.gradingScale![id]})));
        } else {
             // Set a default scale if none exists
            setGradingScale([
                { id: `new-${Date.now()}-1`, grade: 'A+', minScore: 86, maxScore: 100, gpa: 5.0 },
                { id: `new-${Date.now()}-2`, grade: 'A', minScore: 76, maxScore: 85, gpa: 4.0 },
                { id: `new-${Date.now()}-3`, grade: 'B+', minScore: 66, maxScore: 75, gpa: 3.0 },
                { id: `new-${Date.now()}-4`, grade: 'B', minScore: 56, maxScore: 65, gpa: 2.0 },
                { id: `new-${Date.now()}-5`, grade: 'C+', minScore: 46, maxScore: 55, gpa: 1.0 },
                { id: `new-${Date.now()}-6`, grade: 'C', minScore: 40, maxScore: 45, gpa: 0.0 },
                { id: `new-${Date.now()}-7`, grade: 'D', minScore: 0, maxScore: 39, gpa: 0.0 },
            ]);
        }

    }, [selectedProgrammeId, programmes]);


    const handleAddRow = () => {
        setGradingScale([...gradingScale, { id: `new-${Date.now()}`, grade: '', minScore: 0, maxScore: 0, gpa: 0 }]);
    };

    const handleRemoveRow = (id: string) => {
        setGradingScale(gradingScale.filter(g => g.id !== id));
    };

    const handleInputChange = (id: string, field: keyof GradeBoundary, value: string | number) => {
        setGradingScale(gradingScale.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleSaveGrading = async () => {
        if (!selectedProgrammeId) {
            toast({ variant: 'destructive', title: "No Programme Selected" });
            return;
        }
        setSaving(true);
        try {
            const newScale: Record<string, Omit<GradeBoundary, 'id'>> = {};
            gradingScale.forEach(g => {
                const key = g.id.startsWith('new-') ? `grade-${g.grade.replace('+', 'plus')}` : g.id;
                newScale[key] = { grade: g.grade, minScore: Number(g.minScore), maxScore: Number(g.maxScore), gpa: Number(g.gpa) };
            });
            await update(ref(db, `programmes/${selectedProgrammeId}`), { gradingScale: newScale });
            toast({ title: "Grading Scale Saved" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Grading System Setup</CardTitle>
                <CardDescription>Configure the grading system for each programme. This will be used system-wide for result calculation.</CardDescription>
                <div className="pt-4">
                    <Label htmlFor="programme-select">Programme</Label>
                     <Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId} disabled={loading}>
                        <SelectTrigger id="programme-select" className="max-w-md">
                            <SelectValue placeholder="Select a programme..." />
                        </SelectTrigger>
                        <SelectContent>
                            {programmes.map(prog => (
                                <SelectItem key={prog.id} value={prog.id}>{prog.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {selectedProgrammeId ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Grade</TableHead>
                            <TableHead>Min Score (%)</TableHead>
                            <TableHead>Max Score (%)</TableHead>
                            <TableHead>GPA</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)
                        ) : (
                            gradingScale.map(grade => (
                                <TableRow key={grade.id}>
                                    <TableCell><Input value={grade.grade} onChange={(e) => handleInputChange(grade.id, 'grade', e.target.value)} /></TableCell>
                                    <TableCell><Input type="number" value={grade.minScore} onChange={(e) => handleInputChange(grade.id, 'minScore', e.target.value)}/></TableCell>
                                    <TableCell><Input type="number" value={grade.maxScore} onChange={(e) => handleInputChange(grade.id, 'maxScore', e.target.value)}/></TableCell>
                                    <TableCell><Input type="number" step="0.1" value={grade.gpa} onChange={(e) => handleInputChange(grade.id, 'gpa', e.target.value)}/></TableCell>
                                    <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleRemoveRow(grade.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                ) : (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>No Programme Selected</AlertTitle>
                        <AlertDescription>Please select a programme to configure its grading scale.</AlertDescription>
                    </Alert>
                )}
                 {selectedProgrammeId && (
                     <Button variant="outline" size="sm" onClick={handleAddRow} className="mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Add Grade</Button>
                )}
            </CardContent>
            {selectedProgrammeId && (
                 <CardFooter className="flex justify-end border-t pt-6">
                    <Button onClick={handleSaveGrading} disabled={saving || loading}>
                        <Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save Grading Scale'}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

