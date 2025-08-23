
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, PlusCircle, BookOpen, Calendar as CalendarIcon, Trash2, Plus, Power, PowerOff, DollarSign, Pencil, ShieldAlert, Info, Route, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, push, update, remove } from 'firebase/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"


// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; lecturerName?: string; status: 'active' | 'archived'; year: number; };
type CalendarEvent = { id: string; title: string; date: string; };
type Fee = { id: string; name: string; amount: number; };
type FeeTemplate = { id: string; name: string; amount: number; type: 'Mandatory' | 'Optional'; };
type GroupedCourses = { [year: string]: Course[]; };
type Programme = { id: string; name: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; innovationHubActive?: boolean; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Omit<Fee, 'id'>>; optionalFees?: Record<string, Omit<Fee, 'id'>>; };
type DeadlineInfo = { title: string; date: string | null; eventId: string | null; };
type Intake = { id: string; name: string; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, { courses: string[] }> };

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, number>>({});

    const { toast } = useToast();
    
     React.useEffect(() => {
        setLoading(true);
        const semestersRef = ref(db, 'semesters');
        const paymentPlansRef = ref(db, 'settings/paymentPlans');
        const intakesRef = ref(db, 'intakes');
        const programmesRef = ref(db, 'programmes');
        const coursePathsRef = ref(db, 'coursePaths');
        const offeringsRef = ref(db, 'semesterOfferings');
        
        const unsubs = [
            onValue(semestersRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setSemesters(Object.keys(data).map(key => ({ id: key, ...data[key] })));
                } else {
                    setSemesters([]);
                }
            }),
            onValue(paymentPlansRef, (snapshot) => {
                 setAllPaymentPlans(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
            onValue(intakesRef, (snapshot) => {
                setAllIntakes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
            onValue(programmesRef, (snapshot) => {
                 setAllProgrammes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            }),
             onValue(coursePathsRef, (snapshot) => {
                setAllCoursePaths(snapshot.exists() ? Object.values(snapshot.val()) : []);
            }),
            onValue(offeringsRef, (snapshot) => {
                setActivePathSemesters(snapshot.exists() ? snapshot.val() : {});
            })
        ];

        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    

    const handleSaveChanges = async () => {
        setSaving(true);
        try { 
            await set(ref(db, `semesterOfferings`), activePathSemesters);
            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings have been updated.` });
        } catch (error: any) { toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setSaving(false); }
    };
    
    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                <CardDescription>Activate the relevant semester from a course path to make its courses available for registration.</CardDescription>
            </CardHeader>
        </Card>
        
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl">Available Course Paths</CardTitle><CardDescription>For each intake and programme, select the semester number that should be open for registration.</CardDescription></CardHeader>
            <CardContent>
                 {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                ) : allIntakes.length > 0 ? (
                    <Accordion type="multiple" defaultValue={allIntakes.map(p => p.id)} className="w-full">
                           {allIntakes.map(intake => (
                                <AccordionItem value={intake.id} key={intake.id}><AccordionTrigger className="font-bold text-xl">{intake.name}</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            {allProgrammes.map(programme => {
                                                const path = allCoursePaths.find(p => p.intakeId === intake.id && p.programmeId === programme.id);
                                                if (!path || !path.semesters) return null;
                                                return (
                                                    <Card key={programme.id} className="my-2 bg-muted/50">
                                                        <CardHeader className="flex-row items-center justify-between">
                                                            <CardTitle className="text-base">{programme.name}</CardTitle>
                                                            <div className="w-64">
                                                                <Select
                                                                    value={activePathSemesters[path.id]?.toString()}
                                                                    onValueChange={(val) => setActivePathSemesters(prev => ({...prev, [path.id]: Number(val)}))}
                                                                >
                                                                    <SelectTrigger><SelectValue placeholder="No semester active..."/></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="0">None</SelectItem>
                                                                        {Object.keys(path.semesters).map(semNum => (
                                                                            <SelectItem key={semNum} value={semNum}>
                                                                                Semester {semNum}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                             </div>
                                                        </CardHeader>
                                                    </Card>
                                                )
                                            })}
                                            {allProgrammes.every(p => !allCoursePaths.some(path => path.intakeId === intake.id && path.programmeId === p.id)) && (
                                                 <p className="text-sm text-muted-foreground p-4 text-center">No course paths defined for this intake.</p>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                           ))}
                        </Accordion>
                    ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Intakes Found</h3><p className="mt-2 text-sm">Create intakes from the "Intakes & Course Paths" page first.</p></div>
                    )
                }
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                <Button onClick={handleSaveChanges} disabled={saving || loading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
            </CardFooter>
        </Card>
        </div>
    );
}
