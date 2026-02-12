'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookCopy, GanttChart, CalendarRange, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
    credits?: number;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
    coursesByYear?: Record<string, Course[]>;
};


export default function CurriculumMappingPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [programmesSnap, coursesSnap] = await Promise.all([
                    get(ref(db, 'programmes')),
                    get(ref(db, 'courses'))
                ]);

                const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
                
                if (programmesSnap.exists()) {
                    const programmesData = programmesSnap.val();
                    const programmesList: Programme[] = Object.keys(programmesData).map(id => {
                        const prog = programmesData[id];
                        const courses: Course[] = prog.courseIds 
                            ? Object.keys(prog.courseIds)
                                .map(courseId => coursesData[courseId] ? { id: courseId, ...coursesData[courseId] } : null)
                                .filter((c): c is Course => c !== null)
                            : [];

                        const coursesByYear = courses.reduce((acc, course) => {
                            const yearKey = `Year ${course.year}`;
                            if (!acc[yearKey]) {
                                acc[yearKey] = [];
                            }
                            acc[yearKey].push(course);
                            acc[yearKey].sort((a,b) => a.code.localeCompare(b.code));
                            return acc;
                        }, {} as Record<string, Course[]>);

                        const sortedCoursesByYear = Object.fromEntries(
                            Object.entries(coursesByYear).sort(([yearA], [yearB]) => parseInt(yearA.replace('Year ', '')) - parseInt(yearB.replace('Year ', '')))
                        );
                        
                        return { id, name: prog.name, courseIds: prog.courseIds, coursesByYear: sortedCoursesByYear };
                    });
                    setProgrammes(programmesList);
                }
            } catch (error) {
                console.error("Failed to fetch curriculum data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <GanttChart className="h-6 w-6 text-primary" />
                        <CardTitle className="text-2xl font-headline">Curriculum Roadmap</CardTitle>
                    </div>
                    <CardDescription>
                        Visualize the structured progression of courses for each academic programme.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Accordion type="multiple" defaultValue={programmes.map(p => p.id)} className="w-full space-y-4">
                {programmes.map(prog => (
                    <AccordionItem value={prog.id} key={prog.id} className="border rounded-lg bg-card px-4 shadow-sm">
                        <AccordionTrigger className="text-lg font-bold hover:no-underline py-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <GraduationCap className="h-5 w-5 text-primary" />
                                </div>
                                <span className="text-left">{prog.name}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                            <Separator className="mb-6" />
                            <div className="space-y-8">
                                {prog.coursesByYear && Object.keys(prog.coursesByYear).length > 0 ? (
                                    Object.entries(prog.coursesByYear).map(([year, courses]) => (
                                        <div key={year} className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                                <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">{year}</h4>
                                            </div>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {courses.map(course => (
                                                    <div key={course.id} className="flex flex-col gap-2 p-4 border rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
                                                        <div className="flex justify-between items-start">
                                                            <Badge variant="outline" className="font-mono bg-background">{course.code}</Badge>
                                                            {course.credits && <span className="text-[10px] font-bold text-primary">{course.credits} Credits</span>}
                                                        </div>
                                                        <p className="font-bold text-sm group-hover:text-primary transition-colors">{course.name}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                                        <BookCopy className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                                        <p className="text-sm text-muted-foreground italic">No courses mapped to this programme's curriculum yet.</p>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
