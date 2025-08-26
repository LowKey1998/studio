
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, History, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, get, set, onValue, update } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// --- TYPE DEFINITIONS ---
type Course = { id: string; name: string; code: string; };
type Intake = { id: string; name: string; };
type Programme = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; lateRegistrationActive?: boolean; };
type CoursePathHistoryItem = { reason: string; oldCourses: string[]; newCourses: string[]; timestamp: any; };
type CoursePathSemester = { courses: string[]; history?: Record<string, CoursePathHistoryItem>; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, CoursePathSemester> }; // Key is semesterId
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
    const [semesters, setSemesters] = React.useState<Record<string, Semester>>({});
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
            ref(db, 'semesters')
        ];
        
        const unsubs = refs.map((r, i) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(i) {
                case 0: setAllIntakes(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name))); break;
                case 1: setAllProgrammes(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 2: setAllCourses(data); break;
                case 3: setAllCoursePaths(Object.keys(data).map(id => ({ id, ...data[id] }))); break;
                case 4: setActivePathSemesters(data); break;
                case 5: setSemesters(data); break;
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

            await set(ref(db, 'semesterOfferings'), activePathSemesters);

            const usersSnap = await get(ref(db, 'users'));
            const allUsers = usersSnap.exists() ? usersSnap.val() : {};

            const notificationPromises: Promise<void>[] = [];

            for (const pathId in activePathSemesters) {
                for (const semesterId in activePathSemesters[pathId]) {
                    const wasActive = oldOfferings[pathId]?.[semesterId]?.active || false;
                    const isNowActive = activePathSemesters[pathId][semesterId].active;

                    if (isNowActive && !wasActive) {
                        const path = allCoursePaths.find(p => p.id === pathId);
                        const semester = semesters[semesterId];
                        if (path && semester) {
                            const semesterName = semester.name;
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
    
    const handleToggleSemester = (pathId: string, semesterId: string, field: 'active' | 'latePaymentActive') => {
        setActivePathSemesters(prev => {
            const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
        
            if (!newPaths[pathId]) {
                newPaths[pathId] = {};
            }
            if (!newPaths[pathId][semesterId]) {
                newPaths[pathId][semesterId] = { active: false, showReason: false, latePaymentActive: false };
            }
        
            const currentFieldState = newPaths[pathId][semesterId][field] || false;
            newPaths[pathId][semesterId][field] = !currentFieldState;

            return newPaths;
        });
    };
    
    const handleToggleReasonVisibility = (pathId: string, semesterId: string) => {
        setActivePathSemesters(prev => {
            const newPaths = JSON.parse(JSON.stringify(prev)); // Deep copy
            if (!newPaths[pathId] || !newPaths[pathId][semesterId]) return prev;
            newPaths[pathId][semesterId].showReason = !newPaths[pathId][semesterId].showReason;
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
                <CardTitle className="font-headline text-2xl">Registration Management</CardTitle>
                <CardDescription>Activate semesters that are open for registration. Semesters themselves are created in the <Link href="/admin/academics/semester-management" className="underline text-primary">Semester Management</Link> page.</CardDescription>
            </CardHeader>
        </Card>
        
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Registration Status by Course Path</CardTitle>
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
                                            
                                            const sortedSemesterIds = Object.keys(path.semesters).sort((a, b) => (semesters[a]?.year || 0) - (semesters[b]?.year || 0) || (semesters[a]?.semesterInYear || 0) - (semesters[b]?.semesterInYear || 0));

                                            return (
                                                <Card key={programme.id} className="my-2 bg-muted/50">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{programme.name}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {sortedSemesterIds.map(semId => {
                                                            const semData = path.semesters[semId];
                                                            const semester = semesters[semId];
                                                            if (!semester) return null;
                                                            
                                                            const historyItems = semData.history ? Object.values(semData.history) : [];
                                                            const offering = activePathSemesters[path.id]?.[semId] || { active: false, latePaymentActive: false, showReason: false };

                                                            return (
                                                            <div key={semId} className="p-4 border rounded-lg bg-card">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <Label htmlFor={`${path.id}-${semId}`} className="font-bold text-lg">{semester.name}</Label>
                                                                    <div className="flex items-center gap-2">
                                                                         {historyItems.length > 0 && (
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistoryDialog(historyItems)}>
                                                                                <History className="h-4 w-4 text-blue-600"/>
                                                                            </Button>
                                                                        )}
                                                                        <div className="flex items-center space-x-2 border-r pr-2">
                                                                            <Label htmlFor={`late-pay-${path.id}-${semId}`} className="text-xs">Late Fee</Label>
                                                                            <Switch 
                                                                                id={`late-pay-${path.id}-${semId}`} 
                                                                                checked={!!offering.latePaymentActive}
                                                                                onCheckedChange={() => handleToggleSemester(path.id, semId, 'latePaymentActive')}
                                                                            />
                                                                        </div>
                                                                         <div className="flex items-center space-x-2">
                                                                            <Label htmlFor={`${path.id}-${semId}`} className="text-xs">Active</Label>
                                                                            <Switch 
                                                                                id={`${path.id}-${semId}`} 
                                                                                checked={!!offering.active}
                                                                                onCheckedChange={() => handleToggleSemester(path.id, semId, 'active')}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {historyItems.length > 0 && (
                                                                     <div className="flex items-center space-x-2 my-2">
                                                                         <Switch id={`show-reason-${path.id}-${semId}`} checked={!!offering.showReason} onCheckedChange={() => handleToggleReasonVisibility(path.id, semId)}/>
                                                                         <Label htmlFor={`show-reason-${path.id}-${semId}`} className="text-xs">Show change reason to students</Label>
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
                    ) : (<div className="py-16 text-center text-muted-foreground"><BookOpen className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">No Intakes Found</h3><p className="mt-2 text-sm">Create intakes from the "Semester Management" page first.</p></div>
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
