'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Info, 
    MapPin, 
    Clock, 
    CalendarDays, 
    Monitor, 
    Download,
    FileCheck
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfDay, isBefore, isToday } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';

type ExamEntry = {
    id: string;
    courseCode: string;
    courseName: string;
    date: string;
    startTime: string;
    endTime: string;
    venue: string;
    isOnline?: boolean;
    isPublished?: boolean;
};

export default function StudentExamTimetablePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [exams, setExams] = React.useState<ExamEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [academicStanding, setAcademicStanding] = React.useState<string>('');

    React.useEffect(() => {
        if (!user || !userProfile) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [intakesSnap, calendarSnap, semestersSnap, etSnap] = await Promise.all([
                    get(ref(db, 'intakes')),
                    get(ref(db, 'settings/academicCalendar')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'examTimetables'))
                ]);

                const allIntakes = intakesSnap.val() || {};
                const intake = userProfile.intakeId ? allIntakes[userProfile.intakeId] : null;
                const calSettings = calendarSnap.val();

                if (!intake || !calSettings) {
                    setLoading(false);
                    return;
                }

                const intakeStartStr = parseIntakeDate(intake.name);
                if (intakeStartStr) {
                    const state = calculateAcademicState(
                        intakeStartStr,
                        new Date(),
                        calSettings.standardCycles,
                        Object.values(calSettings.anomalies || {})
                    );
                    setAcademicStanding(`Year ${state.year}, Sem ${state.semester}`);

                    const matchingSemesterEntry = Object.entries(semestersSnap.val() || {}).find(([_, s]: [string, any]) => 
                        s.intakeId === userProfile.intakeId && 
                        s.year === state.year && 
                        s.semesterInYear === state.semester
                    );

                    if (matchingSemesterEntry) {
                        const semId = matchingSemesterEntry[0];
                        const semesterExams = etSnap.val()?.[semId] || {};
                        const publishedExams = Object.entries(semesterExams)
                            .map(([id, data]: [string, any]) => ({ id, ...data }))
                            .filter(e => e.isPublished);
                        
                        setExams(publishedExams.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, userProfile]);

    const handleDownloadPdf = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Official Examination Timetable`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Student: ${userProfile?.name || 'N/A'} (${userProfile?.id || 'N/A'})`, 14, 30);
        doc.text(`Academic Standing: ${academicStanding}`, 14, 35);
        doc.text(`Date Generated: ${format(new Date(), 'PPP p')}`, 14, 40);

        autoTable(doc, {
            head: [['Date', 'Time', 'Course', 'Venue', 'Format']],
            body: exams.map(e => [
                format(parseISO(e.date), 'PPP'),
                `${e.startTime} - ${e.endTime}`,
                `${e.courseCode}: ${e.courseName}`,
                e.venue,
                e.isOnline ? 'Online Exam' : 'Physical'
            ]),
            startY: 50,
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80] },
        });

        doc.save('Official_Exam_Timetable.pdf');
    };

    if (loading) return <Skeleton className="h-screen w-full" />;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary rounded-lg shadow-md">
                                <FileCheck className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="font-headline text-2xl">Exam Timetable</CardTitle>
                                <CardDescription>Your official examination schedule for the current semester.</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="h-10 px-4 gap-2 font-black uppercase tracking-widest text-[10px] border-primary/20 bg-background shadow-sm">
                                <CalendarDays className="h-4 w-4 text-primary" />
                                {academicStanding}
                            </Badge>
                            <Button variant="outline" onClick={handleDownloadPdf} disabled={exams.length === 0} className="h-10">
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {exams.length > 0 ? (
                <div className="grid gap-4">
                    {exams.map((exam) => {
                        const isExamToday = isToday(parseISO(exam.date));
                        const isPassed = isBefore(startOfDay(parseISO(exam.date)), startOfDay(new Date())) && !isExamToday;

                        return (
                            <Card key={exam.id} className={cn(
                                "overflow-hidden transition-all hover:shadow-md",
                                isExamToday ? "border-2 border-primary shadow-primary/10" : "border-l-4 border-l-primary/40",
                                isPassed && "opacity-60 grayscale"
                            )}>
                                <CardContent className="p-0">
                                    <div className="flex flex-col md:flex-row">
                                        <div className={cn(
                                            "md:w-48 p-6 flex flex-col items-center justify-center text-center gap-1",
                                            isExamToday ? "bg-primary text-white" : "bg-muted/30 border-r"
                                        )}>
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{format(parseISO(exam.date), 'EEEE')}</span>
                                            <span className="text-2xl font-black">{format(parseISO(exam.date), 'dd MMM')}</span>
                                            <span className="text-[10px] font-bold opacity-60">{format(parseISO(exam.date), 'yyyy')}</span>
                                        </div>
                                        <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg leading-none">{exam.courseCode}: {exam.courseName}</h3>
                                                    {exam.isOnline && <Badge variant="outline" className="text-[8px] uppercase border-blue-200 text-blue-700 bg-blue-50">Online Portal</Badge>}
                                                </div>
                                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-medium">
                                                    <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary opacity-60"/> {exam.startTime} - {exam.endTime}</div>
                                                    <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary opacity-60"/> {exam.venue}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isExamToday && <Badge className="bg-red-600 animate-pulse text-white font-black uppercase text-[10px] tracking-widest px-4 h-8">Today</Badge>}
                                                {exam.isOnline && !isPassed && (
                                                    <Button asChild size="sm" variant={isExamToday ? "default" : "outline"}>
                                                        <Link href={`/student/quizzes`}>Go to Online Exam</Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4">
                    <Info className="h-12 w-12 opacity-10" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold">Timetable Pending</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">The official examination schedule for your cohort has not been published yet. Please check back later.</p>
                    </div>
                </div>
            )}

            <Alert className="bg-muted/50 border-0">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Candidate Notice</AlertTitle>
                <AlertDescription className="text-xs italic leading-relaxed">
                    Please ensure you arrive at the examination venue at least 30 minutes before the scheduled start time. For online exams, ensure your internet connection is stable and you have sufficient power backup.
                </AlertDescription>
            </Alert>
        </div>
    );
}
