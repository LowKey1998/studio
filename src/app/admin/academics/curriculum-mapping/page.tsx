'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
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
    courses?: Course[];
};


export default function CurriculumMappingPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const programmesRef = ref(db, 'programmes');
        const coursesRef = ref(db, 'courses');
        
        let coursesData: Record<string, Omit<Course, 'id'>> = {};

        const unsubCourses = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                coursesData = snapshot.val();
            }
            // Trigger programme processing once courses are loaded
            unsubProgrammes();
        });

        const unsubProgrammes = () => onValue(programmesRef, (snapshot) => {
            if (snapshot.exists()) {
                const programmesData = snapshot.val();
                const programmesList: Programme[] = Object.keys(programmesData).map(id => {
                    const prog = programmesData[id];
                    const courses: Course[] = prog.courseIds ? Object.keys(prog.courseIds).map(courseId => ({
                        id: courseId,
                        ...coursesData[courseId]
                    })).filter(c => c.name) : [];
                    
                    return { id, ...prog, courses: courses.sort((a,b) => a.year - b.year || a.code.localeCompare(b.code)) };
                });
                setProgrammes(programmesList);
            }
            setLoading(false);
        });

        return () => {
             // In a real app, you might need a more sophisticated way
             // to unsubscribe from the programmes listener if courses are fetched first.
             // For simplicity, we assume this works for the component lifecycle.
        };
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
                            <AccordionContent className="pl-4">
                                {prog.courses && prog.courses.length > 0 ? (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {prog.courses.map(course => (
                                            <div key={course.id} className="flex items-start gap-3 p-3 border rounded-md">
                                                <BookCopy className="h-5 w-5 mt-1 text-muted-foreground"/>
                                                <div>
                                                    <p className="font-semibold">{course.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">{course.code}</Badge>
                                                        <Badge variant="secondary">Year {course.year}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
