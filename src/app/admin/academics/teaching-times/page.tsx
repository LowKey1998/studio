"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2, Clock, Info, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type TimeSlot = {
    id: string;
    startTime: string;
    endTime: string;
};

type TeachingTimes = {
    startTime: string;
    endTime: string;
    days: string[];
    sessionDuration: number;
    slots?: TimeSlot[];
};

export default function TeachingTimesPage() {
    const [settings, setSettings] = React.useState<TeachingTimes>({
        startTime: '08:00',
        endTime: '17:00',
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        sessionDuration: 120,
        slots: []
    });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/teachingTimes');
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSettings({
                    ...data,
                    slots: data.slots || []
                });
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

    const handleAddSlot = () => {
        const newSlot: TimeSlot = {
            id: `slot-${Date.now()}`,
            startTime: '08:00',
            endTime: '10:00'
        };
        setSettings(prev => ({
            ...prev,
            slots: [...(prev.slots || []), newSlot]
        }));
    };

    const handleUpdateSlot = (id: string, field: keyof TimeSlot, value: string) => {
        setSettings(prev => ({
            ...prev,
            slots: (prev.slots || []).map(s => s.id === id ? { ...s, [field]: value } : s)
        }));
    };

    const handleRemoveSlot = (id: string) => {
        setSettings(prev => ({
            ...prev,
            slots: (prev.slots || []).filter(s => s.id !== id)
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
            toast({ title: "Settings Saved", description: "Institutional teaching times and slots have been updated." });
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
                <CardDescription>Configure the institutional operating hours and days. Use 24-hour format (e.g. 14:00) for all times.</CardDescription>
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

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-lg font-bold">Standard Time Slots</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddSlot}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Slot
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {(settings.slots || []).map((slot, index) => (
                                    <div key={slot.id} className="flex items-center gap-4 p-3 border rounded-lg bg-card shadow-sm">
                                        <div className="flex-grow grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Start (24h)</Label>
                                                <Input placeholder="e.g. 14:00" value={slot.startTime} onChange={e => handleUpdateSlot(slot.id, 'startTime', e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">End (24h)</Label>
                                                <Input placeholder="e.g. 16:00" value={slot.endTime} onChange={e => handleUpdateSlot(slot.id, 'endTime', e.target.value)} />
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="mt-4 self-end text-destructive" onClick={() => handleRemoveSlot(slot.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {(settings.slots || []).length === 0 && (
                                    <p className="text-sm text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                                        No time slots defined. Add slots to enable the matrix view in Timetable Management.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="start-time">Operating Start (24h)</Label>
                                <Input 
                                    id="start-time" 
                                    placeholder="e.g. 08:00"
                                    value={settings.startTime} 
                                    onChange={e => setSettings(p => ({...p, startTime: e.target.value}))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-time">Operating End (24h)</Label>
                                <Input 
                                    id="end-time" 
                                    placeholder="e.g. 17:00"
                                    value={settings.endTime} 
                                    onChange={e => setSettings(p => ({...p, endTime: e.target.value}))}
                                />
                            </div>
                        </div>

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Matrix View & AI</AlertTitle>
                            <AlertDescription>
                                The **Time Slots** defined here will determine the columns in the Master Timetable matrix. Use 24-hour format (e.g. 14:00) to ensure system consistency.
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