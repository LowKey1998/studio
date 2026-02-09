'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, Info, Loader2, FileUp, Link as LinkIcon, ExternalLink, GraduationCap, RotateCcw } from "lucide-react";
import { db, auth, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, set, update, get, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format, parseISO, differenceInCalendarDays, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { createGoogleDoc } from '@/ai/flows/create-google-doc';

type Submission = { studentId: string; studentName: string; submissionUrl: string; submittedAt: string; isGoogleDoc: boolean; };
type Assignment = { id: string; title: string; description: string; dueDate: string; status: string; daysLate: number; submissions?: Record<string, Submission>; };

export default function StudentCourseAssignmentsPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [assignments, setAssignments] = React.useState<Assignment[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File | null>>({});
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<any>(null);
    const [courseData, setCourseData] = React.useState<any>(null);
    const { toast } = useToast();
    const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

    React.useEffect(() => {
        onAuthStateChanged(auth, user => { if(user) { setCurrentUser(user); onValue(dbRef(db, `users/${user.uid}`), s => setUserData(s.val())); } else setLoading(false); });
    }, []);
    
    React.useEffect(() => {
        if (!currentUser || !courseId) return;
        get(dbRef(db, `courses/${courseId}`)).then(s => setCourseData(s.val()));
        const unsub = onValue(dbRef(db, `assignments/${courseId}`), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setAssignments(Object.keys(data).map(k => {
                    const a = data[k]; const sub = a.submissions?.[currentUser.uid]; const dDate = parseISO(a.dueDate); const today = new Date();
                    let dLate = sub ? differenceInCalendarDays(parseISO(sub.submittedAt), dDate) : differenceInCalendarDays(today, dDate);
                    return { id: k, ...a, status: sub ? 'Submitted' : (isBefore(dDate, today) ? 'Late' : 'Pending'), daysLate: dLate > 0 ? dLate : 0 };
                }).sort((a,b) => b.dueDate.localeCompare(a.dueDate)));
            } else setAssignments([]);
            setLoading(false);
        });
        return () => unsub();
    }, [courseId, currentUser]);
    
    const handleCreateAndLinkDoc = async (a: Assignment) => {
        if (!currentUser || !userData || !courseData) return;
        setActionLoading(a.id);
        try {
            const { documentUrl } = await createGoogleDoc({ userId: currentUser.uid, courseId, assignmentId: a.id, assignmentTitle: `${courseData.code}: ${a.title}` });
            await set(dbRef(db, `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`), { studentId: currentUser.uid, studentName: userData.name, submissionUrl: documentUrl, submittedAt: new Date().toISOString(), isGoogleDoc: true });
            toast({ title: 'Document Created!' }); window.open(documentUrl, '_blank');
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { setActionLoading(null); }
    };

    const handleUploadFile = async (a: Assignment) => {
        const file = selectedFiles[a.id];
        if (!file || !currentUser || !userData) return;
        setActionLoading(a.id);
        try {
            const fRef = storageRef(storage, `submissions/${courseId}/${a.id}/${currentUser.uid}/${file.name}`);
            const url = await getDownloadURL((await uploadBytes(fRef, file)).ref);
            await set(dbRef(db, `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`), { studentId: currentUser.uid, studentName: userData.name, submissionUrl: url, submittedAt: new Date().toISOString(), isGoogleDoc: false });
            toast({ title: "Submitted!" }); setSelectedFiles(prev => ({...prev, [a.id]: null}));
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { setActionLoading(null); }
    }

    const handleUnsubmit = async (a: Assignment) => {
        if (!currentUser || !confirm("Unsubmit this assignment?")) return;
        setActionLoading(a.id);
        try { await remove(dbRef(db, `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`)); toast({ title: 'Submission Removed' }); }
        catch (e: any) { toast({ variant: 'destructive', title: 'Error' }); }
        finally { setActionLoading(null); }
    };

    if(loading) return <Skeleton className="h-96 w-full" />;
    
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {assignments.map(a => {
                const sub = a.submissions?.[currentUser?.uid || ''];
                const sFile = selectedFiles[a.id];
                return (
                    <Card key={a.id} className="shadow-lg">
                        <CardHeader className="flex-row items-center justify-between">
                            <FileText className="h-6 w-6" />
                            <div className="flex flex-col items-end">
                                <Badge variant={a.status === 'Submitted' ? 'default' : 'secondary'}>{a.status}</Badge>
                                {a.daysLate > 0 && <span className="text-[10px] text-destructive font-bold">{a.daysLate} days late</span>}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg">{a.title}</CardTitle>
                            <CardDescription>Due: {format(parseISO(a.dueDate), 'PPP')}</CardDescription>
                            <p className="mt-2 text-sm line-clamp-3">{a.description}</p>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            {sub ? <><Button asChild variant="outline" className="w-full"><a href={sub.submissionUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4"/>View</a></Button><Button variant="ghost" className="w-full text-destructive" onClick={()=>handleUnsubmit(a)} disabled={!!actionLoading}>{actionLoading===a.id ? <Loader2 className="animate-spin h-4 w-4"/> : <RotateCcw className="mr-2 h-4 w-4"/>}Unsubmit</Button></> :
                            <div className="w-full space-y-2"><Button onClick={()=>handleCreateAndLinkDoc(a)} className="w-full" variant="secondary" disabled={!!actionLoading}><GraduationCap className="mr-2 h-4 w-4"/>Google Doc</Button><Button onClick={()=>fileInputRefs.current[a.id]?.click()} className="w-full" variant="outline" disabled={!!actionLoading}><FileUp className="mr-2 h-4 w-4"/>Upload File</Button><input type="file" ref={el=>fileInputRefs.current[a.id]=el} className="hidden" onChange={e=>setSelectedFiles(p=>({...p,[a.id]:e.target.files?.[0]||null}))}/>{sFile && <Button onClick={()=>handleUploadFile(a)} className="w-full" disabled={!!actionLoading}>Submit {sFile.name}</Button>}</div>}
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
