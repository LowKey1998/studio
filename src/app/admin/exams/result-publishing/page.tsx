
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, set, onValue, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
}

type Course = {
    id: string;
    name: string;
    code: string;
};

type GradeApprovalStatus = 'Pending' | 'Approved';
type ResultsPublishedStatus = boolean;

export default function ResultPublishingPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    
    const [gradeStatus, setGradeStatus] = React.useState<GradeApprovalStatus | null>(null);
    const [publishStatus, setPublishStatus] = React.useState<ResultsPublishedStatus | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

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

    // Fetch statuses for selected course
    React.useEffect(() => {
        if (!selectedCourse || !selectedSemester) {
            setGradeStatus(null);
            setPublishStatus(null);
            return;
        }

        const gradeStatusRef = ref(db, `gradeStatus/${selectedSemester}/${selectedCourse}`);
        const gradeUnsub = onValue(gradeStatusRef, (snap) => setGradeStatus(snap.exists() ? snap.val() : 'Pending'));

        const publishStatusRef = ref(db, `resultsPublished/${selectedSemester}/${selectedCourse}`);
        const publishUnsub = onValue(publishStatusRef, (snap) => setPublishStatus(snap.exists() ? snap.val() : false));
        
        return () => {
            gradeUnsub();
            publishUnsub();
        }

    }, [selectedCourse, selectedSemester]);
    
    const handlePublish = async () => {
        if (gradeStatus !== 'Approved') {
            toast({ variant: 'destructive', title: "Cannot Publish", description: "Grades must be approved before they can be published."});
            return;
        }
        setSaving(true);
        try {
            await set(ref(db, `resultsPublished/${selectedSemester}/${selectedCourse}`), true);
            toast({ title: 'Results Published!', description: 'Students can now view their grades for this course.'});
        } catch (e) {
            toast({ variant: 'destructive', title: 'Publishing Failed' });
        } finally {
            setSaving(false);
        }
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>Result Publishing</CardTitle>
                <CardDescription>Publish approved examination results to the student portal.</CardDescription>
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
                {selectedCourse ? (
                     <div className="space-y-4 rounded-lg border p-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Grade Approval Status</h3>
                            {gradeStatus === null ? <Skeleton className="h-6 w-24"/> : <Badge variant={gradeStatus === 'Approved' ? 'default' : 'secondary'}>{gradeStatus}</Badge>}
                        </div>
                         <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Results Published to Students</h3>
                            {publishStatus === null ? <Skeleton className="h-6 w-24"/> : <Badge variant={publishStatus ? 'default' : 'destructive'}>{publishStatus ? 'Published' : 'Not Published'}</Badge>}
                        </div>
                     </div>
                ) : <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Select a Course</AlertTitle><AlertDescription>Please select a semester and course to view publishing status.</AlertDescription></Alert>}
            </CardContent>
             {selectedCourse && (
                <CardFooter className="flex justify-end">
                    <Button onClick={handlePublish} disabled={saving || publishStatus === true || gradeStatus !== 'Approved'}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {publishStatus === true ? <><CheckCircle2 className="mr-2 h-4"/>Results Already Published</> : <><Upload className="mr-2 h-4"/>Publish Results</>}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
