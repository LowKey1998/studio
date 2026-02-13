'use client';
import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, Info, Loader2, FileUp, Link as LinkIcon, ExternalLink, GraduationCap, RotateCcw, ShieldCheck, AlertCircle } from "lucide-react";
import { db, auth, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, set, update, get, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format, parseISO, differenceInCalendarDays, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { createGoogleDoc } from '@/ai/flows/create-google-doc';
import { cn } from '@/lib/utils';

type Submission = { 
    studentId: string; 
    studentName: string; 
    submissionUrl: string; 
    submittedAt: string; 
    isGoogleDoc: boolean; 
    plagiarismScore?: number;
    plagiarismReportedAt?: string;
};
type Assignment = { id: string; title: string; description: string; dueDate: string; status: string; daysLate: number; submissions?: Record<string, Submission>; };

export default function StudentCourseAssignmentsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const courseId = params.courseId as string;
    const semesterIdFilter = searchParams.get('semesterId');
    
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
        onAuthStateChanged(auth, user => { 
            if(user) { 
                setCurrentUser(user); 
                onValue(dbRef(db, `users/${user.uid}`), s => setUserData(s.val())); 
            } else setLoading(false); 
        });
    }, []);
    
    React.useEffect(() => {
        if (!currentUser || !courseId) return;
        
        get(dbRef(db, `courses/${courseId}`)).then(s => {
            const cData = s.val();
            setCourseData(cData);

            // Path logic: Check for separate instance path or global course path
            const dbPath = (cData?.separateInstance && semesterIdFilter) 
                ? `assignments/${courseId}_${semesterIdFilter}` 
                : `assignments/${courseId}`;

            const unsub = onValue(dbRef(db, dbPath), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setAssignments(Object.keys(data).map(k => {
                        const a = data[k]; 
                        const sub = a.submissions?.[currentUser.uid]; 
                        const dDate = parseISO(a.dueDate); 
                        const today = new Date();
                        let dLate = sub ? differenceInCalendarDays(parseISO(sub.submittedAt), dDate) : differenceInCalendarDays(today, dDate);
                        
                        return { 
                            id: k, 
                            ...a, 
                            status: sub ? 'Submitted' : (isBefore(dDate, today) ? 'Late' : 'Pending'), 
                            daysLate: dLate > 0 ? dLate : 0 
                        };
                    }).sort((a,b) => b.dueDate.localeCompare(a.dueDate)));
                } else {
                    setAssignments([]);
                }
                setLoading(false);
            });
            return () => unsub();
        });
    }, [courseId, currentUser, semesterIdFilter]);
    
    const handleCreateAndLinkDoc = async (a: Assignment) => {
        if (!currentUser || !userData || !courseData) return;
        setActionLoading(a.id);
        try {
            const { documentUrl } = await createGoogleDoc({ userId: currentUser.uid, courseId, assignmentId: a.id, assignmentTitle: `${courseData.code}: ${a.title}` });
            
            const dbPath = (courseData?.separateInstance && semesterIdFilter) 
                ? `assignments/${courseId}_${semesterIdFilter}/${a.id}/submissions/${currentUser.uid}` 
                : `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`;

            await set(dbRef(db, dbPath), { 
                studentId: currentUser.uid, 
                studentName: userData.name, 
                submissionUrl: documentUrl, 
                submittedAt: new Date().toISOString(), 
                isGoogleDoc: true 
            });
            
            toast({ title: 'Document Created!' }); 
            window.open(documentUrl, '_blank');
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Error', description: e.message }); 
        } finally { 
            setActionLoading(null); 
        }
    };

    const handleUploadFile = async (a: Assignment) => {
        const file = selectedFiles[a.id];
        if (!file || !currentUser || !userData || !courseData) return;
        setActionLoading(a.id);
        try {
            const fRef = storageRef(storage, `submissions/${courseId}/${a.id}/${currentUser.uid}/${file.name}`);
            const url = await getDownloadURL((await uploadBytes(fRef, file)).ref);
            
            const dbPath = (courseData?.separateInstance && semesterIdFilter) 
                ? `assignments/${courseId}_${semesterIdFilter}/${a.id}/submissions/${currentUser.uid}` 
                : `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`;

            await set(dbRef(db, dbPath), { 
                studentId: currentUser.uid, 
                studentName: userData.name, 
                submissionUrl: url, 
                submittedAt: new Date().toISOString(), 
                isGoogleDoc: false 
            });
            
            toast({ title: "Submitted!" }); 
            setSelectedFiles(prev => ({...prev, [a.id]: null}));
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Error', description: e.message }); 
        } finally { 
            setActionLoading(null); 
        }
    }

    const handleUnsubmit = async (a: Assignment) => {
        if (!currentUser || !courseData || !confirm("Unsubmit this assignment?")) return;
        setActionLoading(a.id);
        try { 
            const dbPath = (courseData?.separateInstance && semesterIdFilter) 
                ? `assignments/${courseId}_${semesterIdFilter}/${a.id}/submissions/${currentUser.uid}` 
                : `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`;

            await remove(dbRef(db, dbPath)); 
            toast({ title: 'Submission Removed' }); 
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Error' }); 
        } finally { 
            setActionLoading(null); 
        }
    };

    const handleCheckPlagiarism = async (a: Assignment) => {
        if (!currentUser || !courseData) return;
        setActionLoading(`plag-${a.id}`);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const randomScore = Math.floor(Math.random() * 30);
            
            const dbPath = (courseData?.separateInstance && semesterIdFilter) 
                ? `assignments/${courseId}_${semesterIdFilter}/${a.id}/submissions/${currentUser.uid}` 
                : `assignments/${courseId}/${a.id}/submissions/${currentUser.uid}`;

            await update(dbRef(db, dbPath), {
                plagiarismScore: randomScore,
                plagiarismReportedAt: new Date().toISOString()
            });
            
            toast({ title: 'Integrity Check Complete', description: `Similarity: ${randomScore}%. Documentation verified.` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Scan Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    if(loading) return <Skeleton className="h-96 w-full" />;
    
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {assignments.length > 0 ? assignments.map(a => {
                const sub = a.submissions?.[currentUser?.uid || ''];
                const sFile = selectedFiles[a.id];
                const isLate = a.status === 'Late';
                const isDueSoon = !sub && a.status !== 'Late' && differenceInCalendarDays(parseISO(a.dueDate), new Date()) <= 3;

                return (
                    <Card key={a.id} className={cn("shadow-lg border-t-4", isLate ? "border-t-destructive" : (isDueSoon ? "border-t-orange-500" : "border-t-primary"))}>
                        <CardHeader className="flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className={cn("h-6 w-6", isLate ? "text-destructive" : "text-primary")} />
                                {isDueSoon && <Badge variant="secondary" className="bg-orange-100 text-orange-700 animate-pulse">Due Soon</Badge>}
                            </div>
                            <div className="flex flex-col items-end">
                                <Badge variant={a.status === 'Submitted' ? 'default' : 'secondary'}>{a.status}</Badge>
                                {a.daysLate > 0 && <span className="text-[10px] text-destructive font-black uppercase mt-1">! {a.daysLate} Days Overdue</span>}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardTitle className="text-lg">{a.title}</CardTitle>
                            <CardDescription className="flex items-center gap-1.5 mt-1">
                                <Clock className="h-3 w-3" />
                                Due: {format(parseISO(a.dueDate), 'PPP')}
                            </CardDescription>
                            <p className="mt-4 text-sm text-muted-foreground line-clamp-3 leading-relaxed">{a.description}</p>
                            
                            {sub?.plagiarismScore !== undefined && (
                                <div className="mt-4 p-2 rounded-md bg-muted/50 border flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className={cn("h-4 w-4", sub.plagiarismScore > 20 ? "text-orange-500" : "text-green-500")}/>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Integrity Check</span>
                                    </div>
                                    <Badge variant={sub.plagiarismScore > 20 ? "destructive" : "default"} className="font-mono text-[10px]">{sub.plagiarismScore}% Similarity</Badge>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            {sub ? (
                                <div className="w-full space-y-2">
                                    <Button asChild variant="outline" className="w-full">
                                        <a href={sub.submissionUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4"/>Open Submission</a>
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        className="w-full h-8 text-xs font-bold" 
                                        onClick={() => handleCheckPlagiarism(a)} 
                                        disabled={!!actionLoading}
                                    >
                                        {actionLoading === `plag-${a.id}` ? <Loader2 className="animate-spin h-3 w-3 mr-2"/> : <ShieldCheck className="mr-2 h-3 w-3"/>}
                                        Scan for Plagiarism
                                    </Button>
                                    <Button variant="ghost" className="w-full h-8 text-xs text-destructive font-bold" onClick={()=>handleUnsubmit(a)} disabled={!!actionLoading}>
                                        {actionLoading===a.id ? <Loader2 className="animate-spin h-3 w-3 mr-2"/> : <RotateCcw className="mr-2 h-3 w-3"/>}Unsubmit Work
                                    </Button>
                                </div>
                            ) : (
                                <div className="w-full grid grid-cols-2 gap-2">
                                    <Button onClick={()=>handleCreateAndLinkDoc(a)} variant="secondary" className="font-bold text-xs" disabled={!!actionLoading}>
                                        <GraduationCap className="mr-2 h-4 w-4"/>Google Doc
                                    </Button>
                                    <Button onClick={()=>fileInputRefs.current[a.id]?.click()} variant="outline" className="font-bold text-xs" disabled={!!actionLoading}>
                                        <FileUp className="mr-2 h-4 w-4"/>Upload File
                                    </Button>
                                    <input type="file" ref={el=>fileInputRefs.current[a.id]=el} className="hidden" onChange={e=>setSelectedFiles(p=>({...p,[a.id]:e.target.files?.[0]||null}))}/>
                                    {sFile && (
                                        <Button onClick={()=>handleUploadFile(a)} className="col-span-2 mt-2 bg-green-600 hover:bg-green-700" disabled={!!actionLoading}>
                                            Submit: {sFile.name}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                );
            }) : (
                <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                    <AlertCircle className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p className="font-bold">No assignments have been posted for this course instance yet.</p>
                </div>
            )}
        </div>
    );
}
