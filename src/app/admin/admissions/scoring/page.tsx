
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Star, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type RubricCriterion = {
    id: string;
    name: string;
    weight: number;
};

type Rubric = {
    id: string;
    name: string;
    criteria: Record<string, Omit<RubricCriterion, 'id'>>;
};

export default function ScoringPage() {
    const [rubrics, setRubrics] = React.useState<Rubric[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [rubricName, setRubricName] = React.useState('');
    const [criteria, setCriteria] = React.useState<RubricCriterion[]>([]);

    const { toast } = useToast();
    
    React.useEffect(() => {
        const rubricsRef = ref(db, 'admissions/rubrics');
        const unsub = onValue(rubricsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setRubrics(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setRubricName('');
        setCriteria([{ id: `new-${Date.now()}`, name: '', weight: 0 }]);
        setIsDialogOpen(false);
    };

    const handleCriterionChange = (id: string, field: 'name' | 'weight', value: string | number) => {
        setCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addCriterion = () => {
        setCriteria(prev => [...prev, { id: `new-${Date.now()}`, name: '', weight: 0 }]);
    };
    
    const removeCriterion = (id: string) => {
        setCriteria(prev => prev.filter(c => c.id !== id));
    };

    const totalWeight = React.useMemo(() => criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0), [criteria]);

    const handleSaveRubric = async () => {
        if (!rubricName.trim() || criteria.some(c => !c.name.trim() || !c.weight)) {
            toast({ variant: 'destructive', title: 'Name and all criteria fields are required.' });
            return;
        }
         if (totalWeight !== 100) {
            toast({ variant: 'destructive', title: 'Total weight for criteria must be 100.' });
            return;
        }
        setSaving(true);
        try {
            const criteriaData: Record<string, Omit<RubricCriterion, 'id'>> = {};
            criteria.forEach(c => {
                const id = c.id.startsWith('new-') ? push(ref(db)).key! : c.id;
                criteriaData[id] = { name: c.name, weight: Number(c.weight) };
            });
            await push(ref(db, 'admissions/rubrics'), { name: rubricName, criteria: criteriaData });
            toast({ title: "Rubric Created" });
            resetForm();
        } catch(e) {
            toast({ variant: 'destructive', title: 'Failed to save rubric.' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteRubric = async (id: string) => {
        await remove(ref(db, `admissions/rubrics/${id}`));
        toast({title: "Rubric deleted."});
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Scoring & Results</CardTitle>
                    <CardDescription>Define scoring criteria and evaluate applicants based on a standardized rubric.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Create Rubric</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Scoring Rubric</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                           <div className="space-y-1">
                               <Label>Rubric Name</Label>
                               <Input value={rubricName} onChange={e => setRubricName(e.target.value)} />
                           </div>
                           <Label>Criteria</Label>
                            <div className="space-y-2">
                                {criteria.map(c => (
                                    <div key={c.id} className="flex items-center gap-2">
                                        <Input placeholder="Criterion Name (e.g., Interview)" value={c.name} onChange={e => handleCriterionChange(c.id, 'name', e.target.value)}/>
                                        <Input type="number" placeholder="Weight" value={c.weight} onChange={e => handleCriterionChange(c.id, 'weight', e.target.value)} className="w-24"/>
                                        <Button variant="ghost" size="icon" onClick={() => removeCriterion(c.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </div>
                             <Button type="button" variant="outline" onClick={addCriterion}>Add Criterion</Button>
                              <p className="text-sm font-bold text-right">Total Weight: {totalWeight} / 100</p>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveRubric} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Rubric</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-48" /> : rubrics.map(rubric => (
                     <Card key={rubric.id} className="mb-4">
                        <CardHeader className="flex-row items-center justify-between">
                             <CardTitle>{rubric.name}</CardTitle>
                             <Button variant="destructive" size="sm" onClick={() => handleDeleteRubric(rubric.id)}>Delete</Button>
                        </CardHeader>
                         <CardContent>
                            <ul className="list-disc pl-5 text-sm">
                                {Object.values(rubric.criteria || {}).map((c, i) => (
                                    <li key={i}>{c.name} ({c.weight}%)</li>
                                ))}
                            </ul>
                        </CardContent>
                     </Card>
                 ))}
            </CardContent>
        </Card>
    );
}
