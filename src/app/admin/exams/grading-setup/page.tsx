
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, PlusCircle, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, set, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type GradeBoundary = {
    id: string;
    grade: string;
    minScore: number;
    maxScore: number;
    gpa: number;
};

export default function GradingSetupPage() {
    const [gradingScale, setGradingScale] = React.useState<GradeBoundary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();
    
    React.useEffect(() => {
        const gradingRef = ref(db, 'settings/gradingScale');
        const unsubscribe = onValue(gradingRef, (snapshot) => {
            if(snapshot.exists()){
                const data = snapshot.val();
                setGradingScale(Object.keys(data).map(id => ({id, ...data[id]})));
            } else {
                setGradingScale([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

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
        setSaving(true);
        try {
            const newScale: Record<string, Omit<GradeBoundary, 'id'>> = {};
            gradingScale.forEach(g => {
                newScale[g.id.startsWith('new-') ? `grade-${g.grade}` : g.id] = { grade: g.grade, minScore: Number(g.minScore), maxScore: Number(g.maxScore), gpa: Number(g.gpa) };
            });
            await set(ref(db, 'settings/gradingScale'), newScale);
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
                <CardDescription>Configure the grading system, including grade boundaries, mark ranges, and GPA points. This will be used system-wide.</CardDescription>
            </CardHeader>
            <CardContent>
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
                <Button variant="outline" size="sm" onClick={handleAddRow} className="mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Add Grade</Button>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
                <Button onClick={handleSaveGrading} disabled={saving || loading}>
                    <Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save Grading Scale'}
                </Button>
            </CardFooter>
        </Card>
    );
}
