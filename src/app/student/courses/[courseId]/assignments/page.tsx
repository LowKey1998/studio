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
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { createGoogleDoc } from '@/ai/flows/create-google-doc';

type Submission = {
    studentId: string;
    studentName: string;
    submissionUrl: string;
    submittedAt: string;
    isGoogleDoc: boolean;
};

type Assignment = {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    status: string; // Calculated client-side
    score?: string;
    submissions?: Record<string, Submission>;
};

const statusConfig: { [key: string]: { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: React.ReactNode } } = {
  "Submitted": { variant: 'default', icon: <CheckCircle2 className="h-4 w-4" /> },
  "Pending": { variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
  "Graded": { variant: 'default', icon: <CheckCircle2 className="h-4 w-4" /> },
  "Late": { variant: 'destructive', icon: <Clock className="h-4 w-4" /> },
};


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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = dbRef(db, `users/${user.uid}`);
            onValue(userRef, (snapshot) => setUserData(snapshot.val()));
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
      }, []);
    
    React.useEffect(() => {
        if (!currentUser || !courseId) return;

        const courseRef = dbRef(db, `courses/${courseId}`);
        get(courseRef).then(snap => { if(snap.exists()) setCourseData(snap.val()) });
        
        const assignmentsRef = dbRef(db, `assignments/${courseId}`);
        const unsubscribe = onValue(assignmentsRef, (snapshot) => {
            if (snapshot.exists()) {
                const assignmentsData = snapshot.val();
                const assignmentsList: Assignment[] = Object.keys(assignmentsData).map(key => {
                    const assignment = assignmentsData[key];
                    const submission = assignment.submissions?.[currentUser.uid];
                    let status = new Date(assignment.dueDate) < new Date() && !submission ? 'Late' : 'Pending';
                    if (submission) {
                        status = 'Submitted';
                    }
                    return {
                        id: key,
                        ...assignment,
                        status,
                    };
                }).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
                setAssignments(assignmentsList);
            } else {
                setAssignments([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();

    }, [courseId, currentUser]);
    
    const handleCreateAndLinkDoc = async (assignment: Assignment) => {
        if (!currentUser || !userData || !courseData) return;
        setActionLoading(assignment.id);
        try {
            const { documentUrl } = await createGoogleDoc({
                userId: currentUser.uid,
                courseId,
                assignmentId: assignment.id,
                assignmentTitle: `${courseData.code}: ${assignment.title}`,
            });

            const submissionRef = dbRef(db, `assignments/${courseId}/${assignment.id}/submissions/${currentUser.uid}`);
            await set(submissionRef, {
                studentId: currentUser.uid,
                studentName: userData.name || 'Student',
                submissionUrl: documentUrl,
                submittedAt: new Date().toISOString(),
                isGoogleDoc: true,
            });

            toast({
                title: 'Document Created!',
                description: 'Your Google Doc has been created and linked to this assignment.',
            });
            
            // Try to open it, though pop-up blockers might stop this. 
            // The record is already saved so they can click "View Submission" later.
            window.open(documentUrl, '_blank');
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Failed to create document',
                description: error.message,
            });
        } finally {
            setActionLoading(null);
        }
    };

    const handleFileChange = (assignmentId: string, file: File | null) => {
        setSelectedFiles(prev => ({ ...prev, [assignmentId]: file }));
    };

    const handleSubmitFile = async (assignment: Assignment) => {
        const file = selectedFiles[assignment.id];
        if (!file || !currentUser || !userData) {
            toast({ variant: 'destructive', title: 'No file selected' });
            return;
        }

        setActionLoading(assignment.id);
        try {
            const fileRef = storageRef(storage, `submissions/${courseId}/${assignment.id}/${currentUser.uid}/${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const submissionRef = dbRef(db, `assignments/${courseId}/${assignment.id}/submissions/${currentUser.uid}`);
            await set(submissionRef, {
                studentId: currentUser.uid,
                studentName: userData.name,
                submissionUrl: downloadURL,
                submittedAt: new Date().toISOString(),
                isGoogleDoc: false
            });

            toast({ title: "Submission Successful!", description: `${file.name} has been submitted.` });
            setSelectedFiles(prev => ({...prev, [assignment.id]: null}));

        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setActionLoading(null);
        }
    }

    const handleUnsubmit = async (assignment: Assignment) => {
        if (!currentUser) return;
        if (!window.confirm("Are you sure you want to unsubmit this assignment? This will remove your current submission record.")) return;

        setActionLoading(assignment.id);
        try {
            const submissionRef = dbRef(db, `assignments/${courseId}/${assignment.id}/submissions/${currentUser.uid}`);
            await remove(submissionRef);
            toast({ title: 'Submission Removed', description: 'You can now upload a new file or create a new document.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Unsubmit Failed', description: error.message });
        } finally {
            setActionLoading(null);
        }
    };

    if(loading) {
        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
                ))}
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            {assignments.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                    {assignments.map((assignment) => {
                        const submission = assignment.submissions?.[currentUser?.uid || ''];
                        const selectedFile = selectedFiles[assignment.id];

                        return (
                            <Card key={assignment.id} className="flex flex-col shadow-lg">
                                <CardHeader>
                                <div className="flex items-center justify-between">
                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                    <Badge variant={statusConfig[assignment.status]?.variant as any ?? 'secondary'} className="flex items-center gap-1">
                                    {statusConfig[assignment.status]?.icon}
                                    {assignment.status}
                                    </Badge>
                                </div>
                                <CardTitle className="pt-4 font-headline text-lg">{assignment.title}</CardTitle>
                                <CardDescription>Due: {format(new Date(assignment.dueDate), 'PPP')}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-3">{assignment.description}</p>
                                    {assignment.score && <p className="mt-2 font-semibold text-primary">Score: {assignment.score}</p>}
                                </CardContent>
                                <CardFooter className="flex flex-col items-end gap-2">
                                {submission ? (
                                    <div className="flex w-full gap-2">
                                        <Button asChild className="flex-1" variant="outline">
                                            <a href={submission.submissionUrl} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="mr-2 h-4 w-4" /> View Submission
                                            </a>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleUnsubmit(assignment)}
                                            disabled={!!actionLoading}
                                        >
                                            {actionLoading === assignment.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <RotateCcw className="h-4 w-4 mr-2" />}
                                            Unsubmit
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="w-full space-y-2">
                                        <div className="flex w-full gap-2">
                                            <Button 
                                                variant="secondary" 
                                                onClick={() => handleCreateAndLinkDoc(assignment)}
                                                disabled={!!actionLoading}
                                                className="flex-1"
                                            >
                                                {actionLoading === assignment.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <GraduationCap className="mr-2 h-4 w-4" />}
                                                Start with Google Docs
                                            </Button>
                                            <input 
                                                type="file" 
                                                ref={el => fileInputRefs.current[assignment.id] = el} 
                                                className="hidden" 
                                                onChange={(e) => handleFileChange(assignment.id, e.target.files?.[0] || null)}
                                            />
                                            <Button 
                                                variant="outline" 
                                                className="flex-1"
                                                onClick={() => fileInputRefs.current[assignment.id]?.click()}
                                                disabled={!!actionLoading}
                                            >
                                                <FileUp className="mr-2 h-4 w-4" /> Upload File
                                            </Button>
                                        </div>
                                         {selectedFile && (
                                            <div className="w-full flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                                <p className="text-sm truncate pr-2">{selectedFile.name}</p>
                                                <Button size="sm" onClick={() => handleSubmitFile(assignment)} disabled={actionLoading === assignment.id}>
                                                     {actionLoading === assignment.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Submit'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Assignments Yet</AlertTitle>
                            <AlertDescription>
                                No assignments have been posted for this course yet. Check back later!
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
