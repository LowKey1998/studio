
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Route, History, Info, Download, Power, PowerOff, ShieldAlert, Pencil, PlusCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getAllStudentAndStaffIds } from '@/lib/firebase';
import { ref, get, set, onValue, update, push } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, CoursePathSemester> };
type SemesterOffering = {
    active: boolean;
    showReason: boolean;
    latePaymentActive?: boolean; 
};

// --- MAIN PAGE COMPONENT ---
export default function RegistrationManagementPage() {
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [activePathSemesters, setActivePathSemesters] = React.useState<Record<string, Record<string, SemesterOffering>>>({});
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
    const [viewingHistory, setViewingHistory] = React.useState<CoursePathHistoryItem[]>([]);
    
    const { toast } = useToast();
    
    React.useEffect(() => {
        setLoading(true);
        const refs = [
            ref(db, 'intakes'),
            ref(db, 'programmes'),
            ref(db, 'courses'),
            ref(db, 'coursePaths'),
            ref(db, 'semesterOfferings'),
        ];
        
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setAllIntakes(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setAllProgrammes(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setAllCourses(data); break;
                case 3: setAllCoursePaths(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 4: setActivePathSemesters(data); break;
            }
        }));
        
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            const oldOfferingsSnap = await get(ref(db, 'semesterOfferings'));
            const oldOfferings = oldOfferingsSnap.exists() ? oldOfferingsSnap.val() : {};

            await set(ref(db, `semesterOfferings`), activePathSemesters);

            const usersSnap = await get(ref(db, 'users'));
            const allUsers = usersSnap.exists() ? usersSnap.val() : {};

            const notificationPromises: Promise<void>[] = [];

            for (const pathId in activePathSemesters) {
                for (const semNum in activePathSemesters[pathId]) {
                    const wasActive = oldOfferings[pathId]?.[semNum]?.active || false;
                    const isNowActive = activePathSemesters[pathId][semNum].active;

                    if (isNowActive && !wasActive) {
                        const path = allCoursePaths.find(p => p.id === pathId);
                        if (path) {
                            const year = Math.floor((Number(semNum) - 1) / 2) + 1;
                            const semesterInYear = ((Number(semNum) - 1) % 2) + 1;
                            const intake = allIntakes.find(i => i.id === path.intakeId);
                            const semesterName = `${intake?.name || ''} Year ${year} Semester ${semesterInYear}`;

                            for (const userId in allUsers) {
                                const user = allUsers[userId];
                                if (user.role === 'Student' && user.intakeId === path.intakeId && user.programmeId === path.programmeId) {
                                     notificationPromises.push(
                                        createNotification(
                                            userId,
                                            `Registration for ${semesterName} is now open.`,
                                            '/student/registration'
                                        )
                                    );
                                }
                            }
                        }
                    }
                }
            }

            if(notificationPromises.length > 0) {
                 await Promise.all(notificationPromises);
                 toast({ title: `${notificationPromises.length} students notified.` });
            }

            toast({ variant: 'success', title: 'Settings Saved', description: `Registration settings have been updated.` });
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { 
            setSaving(false); 
        }
    };
    
    const handleToggleSemester = (pathId: string, semesterNumber: string, field: 'active' | 'latePaymentActive') => {
        setActivePathSemesters(prev => {
            const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
        
            if (!newPaths[pathId]) {
                newPaths[pathId] = {};
            }
            if (!newPaths[pathId][semesterNumber]) {
                newPaths[pathId][semesterNumber] = { active: false, showReason: false, latePaymentActive: false };
            }
        
            const currentFieldState = newPaths[pathId][semesterNumber][field] || false;
            newPaths[pathId][semesterNumber][field] = !currentFieldState;

            return newPaths;
        });
    };
    
    const handleToggleReasonVisibility = (pathId: string, semesterNumber: string) => {
        setActivePathSemesters(prev => {
            const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
            if (!newPaths[pathId]) newPaths[pathId] = {};
            if (!newPaths[pathId][semesterNumber]) {
                newPaths[pathId][semesterNumber] = { active: false, showReason: false, latePaymentActive: false };
            }
            newPaths[pathId][semesterNumber].showReason = !newPaths[pathId][semesterNumber].showReason;
            return newPaths;
        });
    }

    const openHistoryDialog = (historyItems: CoursePathHistoryItem[]) => {
        setViewingHistory(historyItems.sort((a, b) => b.timestamp - a.timestamp));
        setIsHistoryDialogOpen(true);
    };
    

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Activate Course Registrations</CardTitle>
                <CardDescription>Activate which semesters are open for registration for each intake and programme path.</CardDescription>
            </CardHeader>
        </Card>
        
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Course Registration Paths</CardTitle>
                <CardDescription>Toggle the switch for each semester you want to make available for student registration.</CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (<div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
                ) : allIntakes.length > 0 ? (
                    <Accordion type="multiple" defaultValue={allIntakes.map(p => p.id)} className="w-full">
                           {allIntakes.map(intake => (
                                <AccordionItem value={intake.id} key={intake.id}>
                                    <AccordionTrigger className="font-bold text-xl">{intake.name}</AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        {allProgrammes.map(programme => {
                                            const path = allCoursePaths.find(p => p.intakeId === intake.id && p.programmeId === programme.id);
                                            if (!path || !path.semesters) return null;
                                            
                                            const sortedSemesters = Object.entries(path.semesters).sort(([a], [b]) => Number(a) - Number(b));

                                            return (
                                                <Card key={programme.id} className="my-2 bg-muted/50">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{programme.name}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {sortedSemesters.map(([semNum, semData]) => {
                                                            const year = Math.floor((Number(semNum) - 1) / 2) + 1;
                                                            const semesterInYear = (Number(semNum) - 1) % 2 + 1;
                                                            const label = `Year ${year}, Semester ${semesterInYear}`;
                                                            const historyItems = semData.history ? Object.values(semData.history) : [];
                                                            const offering = activePathSemesters[path.id]?.[semNum] || { active: false, latePaymentActive: false, showReason: false };


                                                            return (
                                                            <div key={semNum} className="p-4 border rounded-lg bg-card">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <Label htmlFor={`${path.id}-${semNum}`} className="font-bold text-lg">{label}</Label>
                                                                    <div className="flex items-center gap-2">
                                                                         {historyItems.length > 0 && (
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistoryDialog(historyItems)}>
                                                                                <History className="h-4 w-4 text-blue-600"/>
                                                                            </Button>
                                                                        )}
                                                                        <div className="flex items-center space-x-2 border-r pr-2">
                                                                            <Label htmlFor={`late-pay-${path.id}-${semNum}`} className="text-xs">Late Fee</Label>
                                                                            <Switch 
                                                                                id={`late-pay-${path.id}-${semNum}`} 
                                                                                checked={!!offering.latePaymentActive}
                                                                                onCheckedChange={() => handleToggleSemester(path.id, semNum, 'latePaymentActive')}
                                                                            />
                                                                        </div>
                                                                         <div className="flex items-center space-x-2">
                                                                            <Label htmlFor={`${path.id}-${semNum}`} className="text-xs">Active</Label>
                                                                            <Switch 
                                                                                id={`${path.id}-${semNum}`} 
                                                                                checked={!!offering.active}
                                                                                onCheckedChange={() => handleToggleSemester(path.id, semNum, 'active')}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {historyItems.length > 0 && (
                                                                     <div className="flex items-center space-x-2 my-2">
                                                                         <Switch id={`show-reason-${path.id}-${semNum}`} checked={!!offering.showReason} onCheckedChange={() => handleToggleReasonVisibility(path.id, semNum)}/>
                                                                         <Label htmlFor={`show-reason-${path.id}-${semNum}`} className="text-xs">Show change reason to students</Label>
                                                                     </div>
                                                                )}
                                                                 <div className="text-sm text-muted-foreground space-y-1">
                                                                    {(semData.courses || []).map(courseId => {
                                                                        const course = allCourses[courseId];
                                                                        return course ? <p key={courseId}>{course.code} - {course.name}</p> : null;
                                                                    })}
                                                                </div>
                                                            </div>
                                                            )
                                                        })}
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                        {allProgrammes.every(p => !allCoursePaths.some(path => path.intakeId === intake.id && path.programmeId === p.id)) && (
                                             <p className="text-sm text-muted-foreground p-4 text-center">No course paths defined for this intake.</p>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                           ))}
                        </Accordion>
                    ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Intakes Found</h3><p className="mt-2 text-sm">Create intakes from the "Intakes / Course Paths" page first.</p></div>
                    )
                }
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-4 border-t pt-6">
                <Button onClick={handleSaveChanges} disabled={saving || loading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save Changes'}</Button>
            </CardFooter>
        </Card>
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Semester Change History</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-4">
                    {viewingHistory.map((item, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                            <p className="font-semibold">{item.reason}</p>
                            <p className="text-sm text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                                <div><p className="font-bold">Removed:</p><ul>{(item.oldCourses || []).filter(c => !(item.newCourses || []).includes(c)).map(id => <li key={id}>- {allCourses[id]?.name || 'Unknown Course'}</li>)}</ul></div>
                                <div><p className="font-bold">Added:</p><ul>{(item.newCourses || []).filter(c => !(item.oldCourses || []).includes(c)).map(id => <li key={id}>+ {allCourses[id]?.name || 'Unknown Course'}</li>)}</ul></div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
        </div>
    );
}
