
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type CourseEval = {
    courseId: string;
    courseName: string;
    courseCode: string;
    avgRating: number;
    responses: number;
    feedback: string[];
};

export default function CourseEvaluationPage() {
    const [evaluations, setEvaluations] = React.useState<CourseEval[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [viewingFeedback, setViewingFeedback] = React.useState<CourseEval | null>(null);

    React.useEffect(() => {
        const evalRef = ref(db, 'courseEvaluations');
        const coursesRef = ref(db, 'courses');

        const unsub = onValue(evalRef, (evalSnap) => {
            if (!evalSnap.exists()) {
                setLoading(false);
                return;
            }

            onValue(coursesRef, (courseSnap) => {
                const evalData = evalSnap.val();
                const courseData = courseSnap.val() || {};
                const evalsList: CourseEval[] = [];

                for (const courseId in evalData) {
                    const submissions = Object.values(evalData[courseId]) as { rating: number, feedback: string }[];
                    const totalRating = submissions.reduce((acc, sub) => acc + sub.rating, 0);
                    const avgRating = totalRating / submissions.length;
                    const feedback = submissions.map(s => s.feedback).filter(Boolean);

                    evalsList.push({
                        courseId,
                        courseName: courseData[courseId]?.name || 'Unknown Course',
                        courseCode: courseData[courseId]?.code || 'N/A',
                        avgRating,
                        responses: submissions.length,
                        feedback,
                    });
                }
                setEvaluations(evalsList);
                setLoading(false);
            });
        });
        
        return () => unsub();
    }, []);

    const filteredEvals = evaluations.filter(e => 
        e.courseName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.courseCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Course Evaluation Results</CardTitle>
                <CardDescription>View aggregated results from student course evaluations.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search course by name or code..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Avg. Rating (out of 5)</TableHead>
                            <TableHead>Responses</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                        filteredEvals.map(ev => (
                             <TableRow key={ev.courseId}>
                                <TableCell>{ev.courseName} ({ev.courseCode})</TableCell>
                                <TableCell>{ev.avgRating.toFixed(1)}</TableCell>
                                <TableCell>{ev.responses}</TableCell>
                                <TableCell className="text-right">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" onClick={() => setViewingFeedback(ev)}>
                                                <BarChart2 className="mr-2 h-4 w-4" />View Feedback
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader><DialogTitle>Feedback for {viewingFeedback?.courseName}</DialogTitle></DialogHeader>
                                            <div className="py-4 max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                                                {viewingFeedback?.feedback.map((fb, i) => <blockquote key={i} className="border-l-2 pl-6 italic">{fb}</blockquote>)}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
