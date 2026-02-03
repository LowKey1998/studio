
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2, Clock, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type TeachingTimes = {
    startTime: string;
    endTime: string;
    days: string[];
    sessionDuration: number;
};

export default function TeachingTimesPage() {
    const [settings, setSettings] = React.useState<TeachingTimes>({
        startTime: '08:00',
        endTime: '17:00',
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        sessionDuration: 120
    });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/teachingTimes');
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDayToggle = (day: string) => {
        setSettings(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day]
        }));
    };

    const handleSave = async () => {
        if (settings.days.length === 0) {
            toast({ variant: 'destructive', title: "No Days Selected", description: "Please select at least one teaching day." });
            return;
        }
        setSaving(true);
        try {
            await set(ref(db, 'settings/teachingTimes'), settings);
            toast({ title: "Settings Saved", description: "Institutional teaching times have been updated." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="text-primary"/> Teaching Times Setup</CardTitle>
                <CardDescription>Configure the institutional operating hours and days. These settings are used by the automated timetable generator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {loading ? (
                    <div className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="start-time">Day Start Time</Label>
                                <Input 
                                    id="start-time" 
                                    type="time" 
                                    value={settings.startTime} 
                                    onChange={e => setSettings(p => ({...p, startTime: e.target.value}))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-time">Day End Time</Label>
                                <Input 
                                    id="end-time" 
                                    type="time" 
                                    value={settings.endTime} 
                                    onChange={e => setSettings(p => ({...p, endTime: e.target.value}))}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Teaching Days</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border rounded-md bg-muted/20">
                                {daysOfWeek.map(day => (
                                    <div key={day} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`day-${day}`} 
                                            checked={settings.days.includes(day)} 
                                            onCheckedChange={() => handleDayToggle(day)} 
                                        />
                                        <Label htmlFor={`day-${day}`} className="font-normal cursor-pointer">{day}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration">Default Session Duration (Minutes)</Label>
                            <Input 
                                id="duration" 
                                type="number" 
                                step="15"
                                value={settings.sessionDuration} 
                                onChange={e => setSettings(p => ({...p, sessionDuration: Number(e.target.value)}))}
                            />
                            <p className="text-xs text-muted-foreground">The length of a standard class session (e.g., 120 for 2 hours).</p>
                        </div>

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Timetable Generation</AlertTitle>
                            <AlertDescription>
                                Changing these values will affect the constraints of the AI timetable generator. If your current schedule doesn't fit within the new times, generation may fail.
                            </AlertDescription>
                        </Alert>
                    </>
                )}
            </CardContent>
            <CardFooter className="border-t pt-6">
                <Button onClick={handleSave} disabled={saving || loading} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Teaching Times
                </Button>
            </CardFooter>
        </Card>
    );
}
