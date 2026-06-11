'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db, createNotification } from '@/lib/firebase';
import { ref, get, set, remove, onValue } from 'firebase/database';
import { Loader2, Save, Mail, UserCheck, Shield, BookCheck, ClipboardCheck, Info, Search, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { sendEmail } from '@/ai/flows/send-email-flow';

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; intakeId: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; separateInstance?: boolean; };
type Student = { uid: string; id: string; name: string; email: string; intakeId?: string; };

type MarkerSettings = {
    enabled: boolean;
    exactDayOnly: boolean;
    assignedAt: number;
    assignedBy: string;
};

export default function AssignAttendanceMarkerPage() {
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [attendanceMarkers, setAttendanceMarkers] = React.useState<Record<string, Record<string, MarkerSettings>>>({});
    const [registrations, setRegistrations] = React.useState<any>({});
    const [loading, setLoading] = React.useState(true);

    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [studentSearch, setStudentSearch] = React.useState('');
    
    // Email Template Modal
    const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
    const [savingTemplate, setSavingTemplate] = React.useState(false);
    const [emailTemplate, setEmailTemplate] = React.useState({
        subject: 'Attendance Marker Assignment: [CourseName]',
        body: `<h2>Attendance Marker Privilege Assigned</h2>\n<p>Hello <strong>[Name]</strong>,</p>\n<p>You have been assigned as the attendance marker for the class <strong>[CourseName] ([CourseCode])</strong>.</p>\n<p><strong>Privilege Details:</strong></p>\n<ul>\n  <li><strong>Mark on exact class day only:</strong> [ExactDayOnlyText]</li>\n</ul>\n<p>Please log in to your student portal and navigate to <strong>Academics -> Mark Attendance</strong> to view your roster and record attendance for this class.</p>\n<p>Best regards,<br/>The Academics Department</p>`
    });

    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);
        const dataRefs = {
            intakes: ref(db, 'intakes'),
            semesters: ref(db, 'semesters'),
            courses: ref(db, 'courses'),
            users: ref(db, 'users'),
            calendar: ref(db, 'settings/academicCalendar'),
            markers: ref(db, 'settings/attendanceMarkers'),
            template: ref(db, 'settings/attendanceMarkerEmailTemplate'),
            registrations: ref(db, 'registrations')
        };

        const unsubMarkers = onValue(dataRefs.markers, (snap) => {
            if (snap.exists()) {
                setAttendanceMarkers(snap.val());
            } else {
                setAttendanceMarkers({});
            }
        });

        const loadStaticData = async () => {
            try {
                const [intakeSnap, semSnap, coursesSnap, usersSnap, calSnap, tplSnap, regsSnap] = await Promise.all([
                    get(dataRefs.intakes),
                    get(dataRefs.semesters),
                    get(dataRefs.courses),
                    get(dataRefs.users),
                    get(dataRefs.calendar),
                    get(dataRefs.template),
                    get(dataRefs.registrations)
                ]);

                if (intakeSnap.exists()) {
                    setIntakes(Object.entries(intakeSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                }
                if (semSnap.exists()) {
                    setSemesters(Object.entries(semSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                }
                if (coursesSnap.exists()) {
                    setCourses(Object.entries(coursesSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data })));
                }
                if (usersSnap.exists()) {
                    setAllStudents(
                        Object.entries(usersSnap.val())
                            .filter(([_, u]: [string, any]) => u.role === 'Student')
                            .map(([uid, u]: [string, any]) => ({ uid, ...u }))
                    );
                }
                if (calSnap.exists()) {
                    setCalendarSettings(calSnap.val());
                }
                if (tplSnap.exists()) {
                    setEmailTemplate(tplSnap.val());
                }
                if (regsSnap.exists()) {
                    setRegistrations(regsSnap.val());
                }
            } catch (err) {
                console.error("Error loading data:", err);
                toast({ variant: 'destructive', title: 'Data Load Failed' });
            } finally {
                setLoading(false);
            }
        };

        loadStaticData();

        return () => {
            unsubMarkers();
        };
    }, [toast]);

    // Calculate current standing for selected Intake
    const intakeStanding = React.useMemo(() => {
        if (!selectedIntake || !calendarSettings) return null;
        const intake = intakes.find(i => i.id === selectedIntake);
        if (!intake) return null;
        const intakeStartStr = parseIntakeDate(intake.name);
        if (!intakeStartStr) return null;
        return calculateAcademicState(
            intakeStartStr,
            new Date(),
            calendarSettings.standardCycles,
            Object.values(calendarSettings.anomalies || {})
        );
    }, [selectedIntake, intakes, calendarSettings]);

    // Find active semester matching intake standing
    const activeSemester = React.useMemo(() => {
        if (!selectedIntake || !intakeStanding) return null;
        return semesters.find(s => 
            s.intakeId === selectedIntake && 
            s.year === intakeStanding.year && 
            s.semesterInYear === intakeStanding.semester
        );
    }, [selectedIntake, intakeStanding, semesters]);

    // Filter students enrolled in the selected course for the active semester
    const enrolledStudents = React.useMemo(() => {
        if (!activeSemester || !selectedCourse) return [];
        const list: Student[] = [];

        for (const userId in registrations) {
            const userRegs = registrations[userId];
            const activeReg = userRegs[activeSemester.id];
            if (activeReg && activeReg.courses) {
                const coursesList = Array.isArray(activeReg.courses) 
                    ? activeReg.courses 
                    : Object.keys(activeReg.courses);
                
                if (coursesList.includes(selectedCourse) && (activeReg.status === 'Completed' || activeReg.status === 'Pending Payment')) {
                    const student = allStudents.find(s => s.uid === userId);
                    if (student) {
                        list.push(student);
                    }
                }
            }
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [activeSemester, selectedCourse, registrations, allStudents]);

    // Filter enrolled students by search
    const filteredStudents = React.useMemo(() => {
        return enrolledStudents.filter(s => 
            s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.id.toLowerCase().includes(studentSearch.toLowerCase())
        );
    }, [enrolledStudents, studentSearch]);

    // Format marker settings path key matching student side pathing
    const getMarkerPathKey = () => {
        if (!selectedCourse || !activeSemester) return '';
        const courseObj = courses.find(c => c.id === selectedCourse);
        return (courseObj?.separateInstance && activeSemester) 
            ? `${selectedCourse}_${activeSemester.id}` 
            : selectedCourse;
    };

    // Save Email Template
    const handleSaveTemplate = async () => {
        setSavingTemplate(true);
        try {
            await set(ref(db, 'settings/attendanceMarkerEmailTemplate'), emailTemplate);
            toast({ title: 'Template Saved Successfully' });
            setIsTemplateModalOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSavingTemplate(false);
        }
    };

    // Toggle Attendance Marker Privilege
    const handleTogglePrivilege = async (student: Student, isChecked: boolean) => {
        const pathKey = getMarkerPathKey();
        if (!pathKey || !selectedCourse || !activeSemester) return;

        setActionLoading(student.uid);
        try {
            const markerRef = ref(db, `settings/attendanceMarkers/${pathKey}/${student.uid}`);
            const courseObj = courses.find(c => c.id === selectedCourse);

            if (isChecked) {
                // Grant privilege
                const markerData: MarkerSettings = {
                    enabled: true,
                    exactDayOnly: true, // Default to true
                    assignedAt: Date.now(),
                    assignedBy: 'Admin'
                };
                await set(markerRef, markerData);

                // Create dashboard notification
                await createNotification(
                    student.uid,
                    `You have been assigned as the attendance marker for the class ${courseObj?.name || 'Class'}.`,
                    `/student/attendance/mark-attendance`
                );

                // Send Email Notification
                if (student.email) {
                    const replaceTags = (text: string) => {
                        return text
                            .replace(/\[Name\]/g, student.name)
                            .replace(/\[CourseName\]/g, courseObj?.name || '')
                            .replace(/\[CourseCode\]/g, courseObj?.code || '')
                            .replace(/\[ExactDayOnlyText\]/g, 'Yes (Only allowed to mark on exact scheduled class days)');
                    };

                    await sendEmail({
                        to: [student.email],
                        subject: replaceTags(emailTemplate.subject),
                        body: replaceTags(emailTemplate.body)
                    }).catch(err => console.warn("Email send failed:", err));
                }

                toast({ title: 'Privilege Granted', description: `${student.name} is now an attendance marker.` });
            } else {
                // Revoke privilege
                await remove(markerRef);
                toast({ title: 'Privilege Revoked', description: `Removed attendance marking privilege from ${student.name}.` });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    };

    // Toggle Exact Day Only Restriction
    const handleToggleExactDay = async (student: Student, isChecked: boolean) => {
        const pathKey = getMarkerPathKey();
        if (!pathKey) return;

        setActionLoading(student.uid + '_day');
        try {
            const exactDayRef = ref(db, `settings/attendanceMarkers/${pathKey}/${student.uid}/exactDayOnly`);
            await set(exactDayRef, isChecked);
            toast({ title: 'Preference Updated', description: `Exact day marking set to ${isChecked ? 'Enabled' : 'Disabled'}.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const pathKey = getMarkerPathKey();

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-headline font-bold">Assign Attendance Marker</CardTitle>
                        <CardDescription>Authorize students to record attendance for their enrolled courses.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" /> Email Settings
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="intake-select">Select Pathway / Intake</Label>
                            <Select value={selectedIntake} onValueChange={(val) => { setSelectedIntake(val); setSelectedCourse(''); }}>
                                <SelectTrigger id="intake-select">
                                    <SelectValue placeholder="Choose Intake..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedIntake && (
                            <div className="space-y-2">
                                <Label htmlFor="course-select">Select Class / Course</Label>
                                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                                    <SelectTrigger id="course-select">
                                        <SelectValue placeholder="Choose Course..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code}: {c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {selectedIntake && intakeStanding && (
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="px-3 py-1 font-bold">
                                Cohort Standing: Year {intakeStanding.year}, Semester {intakeStanding.semester}
                            </Badge>
                            {activeSemester ? (
                                <Badge variant="outline" className="text-green-600 bg-green-50/50 border-green-200">
                                    Active Semester: {activeSemester.name}
                                </Badge>
                            ) : (
                                <Badge variant="destructive">
                                    No Active Semester Record Found
                                </Badge>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedCourse && activeSemester && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg font-headline">Roster & Privileges</CardTitle>
                        <CardDescription>Select student(s) to designate as marker(s) for the current cohort.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search enrolled students..." 
                                className="pl-8" 
                                value={studentSearch} 
                                onChange={e => setStudentSearch(e.target.value)} 
                            />
                        </div>

                        {filteredStudents.length > 0 ? (
                            <div className="border rounded-lg overflow-hidden bg-card">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[120px]">Student ID</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-center w-[180px]">Attendance Marker</TableHead>
                                            <TableHead className="text-center w-[180px]">Exact Day Only</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map((student) => {
                                            const settings = attendanceMarkers[pathKey]?.[student.uid];
                                            const isMarker = !!settings?.enabled;
                                            const isExactDayOnly = settings?.exactDayOnly !== false;

                                            return (
                                                <TableRow key={student.uid}>
                                                    <TableCell className="font-mono text-xs uppercase">{student.id}</TableCell>
                                                    <TableCell className="font-semibold">{student.name}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{student.email}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center items-center">
                                                            {actionLoading === student.uid ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            ) : (
                                                                <Switch 
                                                                    checked={isMarker} 
                                                                    onCheckedChange={(checked) => handleTogglePrivilege(student, checked)} 
                                                                />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center items-center">
                                                            {actionLoading === student.uid + '_day' ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            ) : (
                                                                <Switch 
                                                                    disabled={!isMarker}
                                                                    checked={isExactDayOnly} 
                                                                    onCheckedChange={(checked) => handleToggleExactDay(student, checked)} 
                                                                />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                                <Info className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                                <p className="text-sm text-muted-foreground italic">No students found matching the selected filters.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Email Template Modal Dialog */}
            <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Email Notification Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <Alert className="bg-primary/5 border-primary/20">
                            <Info className="h-4 w-4 text-primary" />
                            <CardDescription>
                                Customizes the email notification sent to students when they are selected as an attendance marker.
                                Supported placeholders: <code>[Name]</code>, <code>[CourseName]</code>, <code>[CourseCode]</code>, <code>[ExactDayOnlyText]</code>.
                            </CardDescription>
                        </Alert>

                        <div className="space-y-1">
                            <Label htmlFor="tpl-subject">Email Subject</Label>
                            <Input 
                                id="tpl-subject"
                                value={emailTemplate.subject} 
                                onChange={e => setEmailTemplate(p => ({ ...p, subject: e.target.value }))} 
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="tpl-body">Email Body (HTML)</Label>
                            <Textarea 
                                id="tpl-body"
                                rows={10} 
                                className="font-mono text-xs"
                                value={emailTemplate.body} 
                                onChange={e => setEmailTemplate(p => ({ ...p, body: e.target.value }))} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
                            {savingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
