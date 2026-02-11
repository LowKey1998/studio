'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, PlusCircle, Save, Trash2, Loader2, Info, AlertTriangle } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
];

export default function SemesterSetupPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [standardCycles, setStandardCycles] = React.useState([
        { semester: 1, startMonth: 0 },
        { semester: 2, startMonth: 6 }
    ]);
    const [anomalies, setAnomalies] = React.useState<any[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/academicCalendar');
        const unsub = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.standardCycles) setStandardCycles(data.standardCycles);
                if (data.anomalies) setAnomalies(Object.values(data.anomalies));
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await set(ref(db, 'settings/academicCalendar'), {
                standardCycles,
                anomalies: anomalies.reduce((acc, a, i) => ({ ...acc, [i]: a }), {})
            });
            toast({ title: "Calendar settings saved." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Save failed" });
        } finally {
            setSaving(false);
        }
    };

    const addAnomaly = () => {
        setAnomalies([...anomalies, { year: 1, semester: 1, overrideStartDate: '', intakeId: '' }]);
    };

    if (loading) return <div className="p-6 space-y-4"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calendar className="text-primary"/> Institutional Academic Cycles</CardTitle>
                    <CardDescription>Define the standard months when semesters begin. This controls the automatic "Year/Semester" labels throughout the system.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {standardCycles.map((cycle, i) => (
                            <div key={i} className="p-4 border rounded-lg bg-muted/20 space-y-3">
                                <Label className="font-bold">Semester {cycle.semester} Start</Label>
                                <Select 
                                    value={String(cycle.startMonth)} 
                                    onValueChange={(val) => {
                                        const next = [...standardCycles];
                                        next[i].startMonth = Number(val);
                                        setStandardCycles(next);
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {months.map((m, idx) => <SelectItem key={idx} value={String(idx)}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle className="text-orange-500 h-5 w-5"/> Calendar Anomalies</h3>
                                <p className="text-sm text-muted-foreground">Override the standard calendar for specific delays or changes.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={addAnomaly}><PlusCircle className="mr-2 h-4 w-4"/> Add Anomaly</Button>
                        </div>

                        {anomalies.map((a, i) => (
                            <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
                                <div className="space-y-1">
                                    <Label className="text-xs">Academic Year</Label>
                                    <Input type="number" value={a.year} onChange={e => {
                                        const next = [...anomalies];
                                        next[i].year = Number(e.target.value);
                                        setAnomalies(next);
                                    }} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Semester</Label>
                                    <Input type="number" value={a.semester} onChange={e => {
                                        const next = [...anomalies];
                                        next[i].semester = Number(e.target.value);
                                        setAnomalies(next);
                                    }} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Effective From</Label>
                                    <Input type="date" value={a.overrideStartDate} onChange={e => {
                                        const next = [...anomalies];
                                        next[i].overrideStartDate = e.target.value;
                                        setAnomalies(next);
                                    }} />
                                </div>
                                <div className="flex items-end">
                                    <Button variant="ghost" size="icon" onClick={() => setAnomalies(anomalies.filter((_, idx) => idx !== i))}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="border-t pt-6">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Calendar Rules
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
