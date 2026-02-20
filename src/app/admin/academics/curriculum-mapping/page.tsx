'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookCopy, GanttChart, CalendarRange, GraduationCap, Search, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
    totalCredits?: number;
};

export default function CurriculumMappingPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

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

                        let totalProgrammeCredits = 0;
                        const coursesByYear = courses.reduce((acc, course) => {
                            const yearKey = `Year ${course.year}`;
                            if (!acc[yearKey]) {
                                acc[yearKey] = [];
                            }
                            acc[yearKey].push(course);
                            acc[yearKey].sort((a,b) => a.code.localeCompare(b.code));
                            totalProgrammeCredits += (Number(course.credits) || 0);
                            return acc;
                        }, {} as Record<string, Course[]>);

                        const sortedCoursesByYear = Object.fromEntries(
                            Object.entries(coursesByYear).sort(([yearA], [yearB]) => parseInt(yearA.replace('Year ', '')) - parseInt(yearB.replace('Year ', '')))
                        );
                        
                        return { 
                            id, 
                            name: prog.name, 
                            courseIds: prog.courseIds, 
                            coursesByYear: sortedCoursesByYear,
                            totalCredits: totalProgrammeCredits
                        };
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

    const filteredProgrammes = React.useMemo(() => {
        return programmes.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [programmes, searchTerm]);

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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <GanttChart className="h-6 w-6 text-primary" />
                                <CardTitle className="text-2xl font-headline text-primary">Curriculum Roadmap</CardTitle>
                            </div>
                            <CardDescription>
                                Visualize the structured progression of courses and credit weighting for each academic programme.
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search programmes..." 
                                className="pl-8 bg-background shadow-sm h-10 border-primary/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Accordion type="multiple" defaultValue={filteredProgrammes.length === 1 ? [filteredProgrammes[0].id] : []} className="w-full space-y-4">
                {filteredProgrammes.map(prog => (
                    <AccordionItem value={prog.id} key={prog.id} className="border rounded-xl bg-card px-4 shadow-sm transition-all hover:shadow-md">
                        <AccordionTrigger className="text-lg font-bold hover:no-underline py-6">
                            <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <GraduationCap className="h-5 w-5 text-primary" />
                                    </div>
                                    <span className="text-left">{prog.name}</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                        {Object.keys(prog.courseIds || {}).length} Courses
                                    </Badge>
                                    <Badge variant="outline" className="border-primary/20 text-primary">
                                        {prog.totalCredits} Total Credits
                                    </Badge>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                            <Separator className="mb-6" />
                            <div className="space-y-10">
                                {prog.coursesByYear && Object.keys(prog.coursesByYear).length > 0 ? (
                                    Object.entries(prog.coursesByYear).map(([year, courses]) => {
                                        const yearCredits = courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
                                        return (
                                            <div key={year} className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarRange className="h-4 w-4 text-primary" />
                                                        <h4 className="font-bold text-sm uppercase tracking-widest text-primary">{year}</h4>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                                                        Year Weight: {yearCredits} Credits
                                                    </span>
                                                </div>
                                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {courses.map(course => (
                                                        <div key={course.id} className="flex flex-col gap-2 p-4 border rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group relative overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <div className="flex justify-between items-start">
                                                                <Badge variant="outline" className="font-mono bg-background text-[10px]">{course.code}</Badge>
                                                                {course.credits && (
                                                                    <Badge className="text-[9px] font-black uppercase tracking-tighter bg-primary/10 text-primary hover:bg-primary/10 border-primary/20">
                                                                        {course.credits} Credits
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="font-bold text-sm group-hover:text-primary transition-colors pr-2">{course.name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-16 bg-muted/20 rounded-xl border-2 border-dashed">
                                        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                                        <h3 className="text-lg font-semibold text-muted-foreground">Empty Curriculum</h3>
                                        <p className="text-sm text-muted-foreground italic max-w-xs mx-auto">No courses have been mapped to this programme's roadmap yet.</p>
                                        <Button variant="link" asChild className="mt-4">
                                            <Link href="/admin/programmes">Configure Programme Courses &rarr;</Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
                {filteredProgrammes.length === 0 && !loading && (
                    <div className="py-20 text-center text-muted-foreground">
                        <Search className="mx-auto h-12 w-12 opacity-10 mb-4" />
                        <p className="text-sm">No programmes matching "{searchTerm}"</p>
                    </div>
                )}
            </Accordion>
        </div>
    );
}
