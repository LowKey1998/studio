'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookCopy, GanttChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
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
                        
                        return { id, ...prog, coursesByYear: sortedCoursesByYear };
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
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Curriculum Mapping</CardTitle>
                <CardDescription>Visualize and manage the curriculum, ensuring alignment with learning outcomes and accreditation standards.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {programmes.map(prog => (
                        <AccordionItem value={prog.id} key={prog.id}>
                            <AccordionTrigger className="text-lg font-semibold">
                                <div className="flex items-center gap-2">
                                    <GanttChart className="h-5 w-5 text-primary" />
                                    {prog.name}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pl-4 space-y-4">
                                {prog.coursesByYear && Object.keys(prog.coursesByYear).length > 0 ? (
                                    Object.entries(prog.coursesByYear).map(([year, courses]) => (
                                        <div key={year}>
                                            <h4 className="font-semibold text-md mb-2">{year}</h4>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {courses.map(course => (
                                                    <div key={course.id} className="flex items-start gap-3 p-3 border rounded-md bg-muted/50">
                                                        <BookCopy className="h-5 w-5 mt-1 text-muted-foreground"/>
                                                        <div>
                                                            <p className="font-semibold">{course.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline">{course.code}</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground py-4">No courses assigned to this programme yet.</p>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}
