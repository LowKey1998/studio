'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
}

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerId: string;
};

type AssessmentScore = {
    score?: number;
    feedback?: string;
}

type FinalExamScore = {
    finalExam?: AssessmentScore;
};

type AllScores = Record<string, FinalExamScore>; // studentUid -> scores

export default function FinalExamEntryPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [students, setStudents] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    // Fetch semesters
    React.useEffect(() => {
        const semestersRef = ref(db, 'semesters');
        const unsub = onValue(semestersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived');
                setSemesters(list.sort((a,b) => b.name.localeCompare(a.name)));
                if(list.length > 0) setSelectedSemester(list[0].id);
            }
             setLoading(false);
        });
        return () => unsub();
    }, []);

     // Fetch courses for selected semester
    React.useEffect(() => {
        if (!selectedSemester) return;
        setLoading(true);
        const fetchCourses = async () => {
            const regsSnap = await get(ref(db, 'registrations'));
            const coursesSnap = await get(ref(db, 'courses'));
            if (!regsSnap.exists() || !coursesSnap.exists()) {
                setCourses([]); setLoading(false); return;
            }
            const allCourses = coursesSnap.val();
            
            const coursesInSemester = new Set<string>();
            Object.values(regsSnap.val()).forEach((userRegs: any) => {
                 if (userRegs[selectedSemester]) {
                    userRegs[selectedSemester].courses.forEach((cid: string) => coursesInSemester.add(cid));
                }
            });
            
            setCourses(Array.from(coursesInSemester).map(cid => ({ id: cid, ...allCourses[cid] })).sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        };
        fetchCourses();
    }, [selectedSemester]);

    // Fetch students and scores for selected course
    React.useEffect(() => {
        if (!selectedCourse) {
            setStudents([]);
            setScores({});
            return;
        }
        setLoading(true);
        const fetchData = async () => {
            try {
                // Fetch Enrolled Students
                const allUsersSnapshot = await get(ref(db, 'users'));
                const allUsers = allUsersSnapshot.val();
                const registrationsSnapshot = await get(ref(db, 'registrations'));
                const enrolledStudentUids: string[] = [];

                if (registrationsSnapshot.exists()) {
                    const allRegistrations = registrationsSnapshot.val();
                    for (const userId in allRegistrations) {
                         const semesterReg = allRegistrations[userId][selectedSemester];
                        if (semesterReg && semesterReg.courses.includes(selectedCourse) && (semesterReg.status === 'Completed' || semesterReg.status === 'Pending Payment')) {
                            enrolledStudentUids.push(userId);
                        }
                    }
                }
                const studentList: Student[] = enrolledStudentUids.map(uid => ({
                    uid,
                    id: allUsers[uid]?.id || 'N/A',
                    name: allUsers[uid]?.name || 'Unknown',
                })).sort((a, b) => a.name.localeCompare(b.name));
                setStudents(studentList);

                // Fetch existing scores
                const scoresRef = ref(db, `assessments/${selectedCourse}`);
                const scoresSnapshot = await get(scoresRef);
                setScores(scoresSnapshot.exists() ? scoresSnapshot.val() : {});

            } catch (error: any) {
                console.error("Error fetching data:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch data." });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedCourse, selectedSemester, toast]);

    const handleScoreChange = (studentUid: string, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (isNaN(numericValue) || numericValue < 0 || numericValue > 100)) {
            toast({ variant: 'destructive', title: "Invalid Score", description: "Score must be between 0 and 100." });
            return;
        }

        setScores(prev => ({
            ...prev,
            [studentUid]: {
                ...prev[studentUid],
                finalExam: { ...(prev[studentUid]?.finalExam || {}), score: numericValue }
            },
        }));
    };

    const handleSaveScores = async () => {
        if (!selectedCourse) return;
        setSaving(true);
        try {
            const scoresRef = ref(db, `assessments/${selectedCourse}`);
            await set(scoresRef, scores);

            // Notify students
            const course = courses.find(c => c.id === selectedCourse);
            const notificationPromises = Object.keys(scores).map(uid => 
                createNotification(
                    uid,
                    `Your final exam results for ${course?.code || 'course'} have been posted.`,
                    `/student/courses/${selectedCourse}/results`
                )
            );
            await Promise.all(notificationPromises);

            toast({ title: "Scores Saved", description: "Final exam scores have been updated and students notified." });
        } catch (error: any) {
            console.error("Error saving scores:", error);
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Final Examination Entry</CardTitle>
                <CardDescription>Select a semester and course to enter final exam scores. All scores are out of 100.</CardDescription>
                <div className="grid md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-1">
                        <Label>Semester</Label>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{semesters.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Course</Label>
                        <Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger><SelectValue placeholder="Select course..."/></SelectTrigger><SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? ( <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : selectedCourse && students.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead className="min-w-[150px]">Student Name</TableHead><TableHead className="min-w-[100px]">Student ID</TableHead><TableHead>Final Exam Score</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell>{student.id}</TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" max="100" className="w-24" value={scores[student.uid]?.finalExam?.score ?? ''} onChange={(e) => handleScoreChange(student.uid, e.target.value)} placeholder="-"/>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Data</AlertTitle><AlertDescription>
                        {selectedCourse ? 'There are no students with completed registrations for this course.' : 'Please select a semester and course to begin.'}
                    </AlertDescription></Alert>
                )}
            </CardContent>
            {students.length > 0 && (
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button onClick={handleSaveScores} disabled={saving || loading}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save All Scores'}</Button>
                </CardFooter>
            )}
        </Card>
    );
}