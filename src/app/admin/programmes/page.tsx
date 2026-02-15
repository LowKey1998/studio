'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Trash2, BookCopy, Pencil, Search, ChevronRight, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update, serverTimestamp } from 'firebase/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
    status: 'active' | 'archived';
    cost?: number;
};

type Programme = {
    id: string;
    name: string;
    tuitionFee?: number;
    courseIds?: Record<string, boolean>;
};

type Lecturer = {
    uid: string;
    name: string;
};

export default function ProgrammesPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [lecturers, setLecturers] = React.useState<Lecturer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    
    // Edit Programme Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingProgramme, setEditingProgramme] = React.useState<Programme | null>(null);
    const [programmeName, setProgrammeName] = React.useState('');
    const [programmeTuition, setProgrammeTuition] = React.useState('');
    const [selectedCourses, setSelectedCourses] = React.useState<Record<string, boolean>>({});
    const [courseSearchTerm, setCourseSearchTerm] = React.useState('');
    
    // Create Course Dialog State
    const [isCourseDialogOpen, setIsCourseDialogOpen] = React.useState(false);
    const [newCourseName, setNewCourseName] = React.useState('');
    const [newCourseCode, setNewCourseCode] = React.useState('');
    const [newCourseCost, setNewCourseCost] = React.useState('');
    const [newCourseYear, setNewCourseYear] = React.useState('');
    const [selectedLecturerId, setSelectedLecturerId] = React.useState('');
    const [separateInstance, setSeparateInstance] = React.useState(false);
    const [courseFormLoading, setCourseFormLoading] = React.useState(false);

    const { toast } = useToast();
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, coursesSnap, programmesSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'courses')),
                get(ref(db, 'programmes'))
            ]);
            
            const lecturersList: Lecturer[] = [];
            if (usersSnap.exists()) {
                const usersData = usersSnap.val();
                Object.keys(usersData).forEach(uid => {
                    if (usersData[uid].role === 'Staff' && usersData[uid].subRoles?.includes('Lecturer')) {
                        lecturersList.push({ uid, name: usersData[uid].name });
                    }
                });
            }
            setLecturers(lecturersList);
            setAllCourses(coursesSnap.exists() ? Object.keys(coursesSnap.val()).map(key => ({ id: key, ...coursesSnap.val()[key] })) : []);
            setProgrammes(programmesSnap.exists() ? Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })) : []);
        } catch(e) {
            console.error(e);
            toast({ variant: "destructive", title: "Load Failed" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const handleFormSubmit = async () => {
        if (!programmeName) return;
        setFormLoading(true);
        try {
            const programmeData = { name: programmeName, tuitionFee: programmeTuition ? parseFloat(programmeTuition) : null, courseIds: selectedCourses };
            if (editingProgramme) {
                await update(ref(db, `programmes/${editingProgramme.id}`), programmeData);
                toast({ title: 'Programme Updated' });
            } else {
                await push(ref(db, 'programmes'), programmeData);
                toast({ title: 'Programme Created' });
            }
            setIsDialogOpen(false); fetchData();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed' }); } finally { setFormLoading(false); }
    };
    
    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCourseName || !newCourseCode) return;
        setCourseFormLoading(true);
        try {
            const newCourseRef = push(ref(db, 'courses'));
            const courseId = newCourseRef.key!;
            await set(newCourseRef, { name: newCourseName, code: newCourseCode, cost: Number(newCourseCost) || 0, year: Number(newCourseYear) || 1, lecturerId: selectedLecturerId || null, separateInstance, status: 'active' });
            setSelectedCourses(prev => ({...prev, [courseId]: true}));
            toast({ title: 'Course added and linked' });
            setIsCourseDialogOpen(false); fetchData();
            setNewCourseName(''); setNewCourseCode(''); setNewCourseCost(''); setNewCourseYear('');
        } catch (e) { toast({ variant: 'destructive', title: 'Course Creation Failed' }); } finally { setCourseFormLoading(false); }
    };

    const groupedCourses = React.useMemo(() => {
        const filtered = allCourses.filter(c => c.status === 'active' && (c.name.toLowerCase().includes(courseSearchTerm.toLowerCase()) || c.code.toLowerCase().includes(courseSearchTerm.toLowerCase())));
        return filtered.reduce((acc, c) => {
            const yearKey = `Year ${c.year || '1'}`;
            if (!acc[yearKey]) acc[yearKey] = [];
            acc[yearKey].push(c);
            return acc;
        }, {} as Record<string, Course[]>);
    }, [allCourses, courseSearchTerm]);

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="text-2xl">Programmes</CardTitle><CardDescription>Manage academic programmes and curriculum catalogs.</CardDescription></div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/admin/courses"><BookCopy className="mr-2 h-4 w-4" /> Course Catalog</Link></Button>
                    <Button onClick={() => { setEditingProgramme(null); setProgrammeName(''); setProgrammeTuition(''); setSelectedCourses({}); setIsDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Programme</Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-48 w-full"/> : 
                <div className="space-y-4">
                    {programmes.map(prog => (
                        <Card key={prog.id} className="flex flex-row items-center justify-between p-4">
                            <div><CardTitle className="text-lg">{prog.name}</CardTitle><CardDescription>{prog.tuitionFee ? `ZMW ${prog.tuitionFee.toFixed(2)} / semester` : `${Object.keys(prog.courseIds || {}).length} courses`}</CardDescription></div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setEditingProgramme(prog); setProgrammeName(prog.name); setProgrammeTuition(prog.tuitionFee?.toString() || ''); setSelectedCourses(prog.courseIds || {}); setIsDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4"/>Edit</Button>
                                <Button variant="destructive" size="icon" onClick={async () => { if(confirm("Delete programme?")) { await remove(ref(db, `programmes/${prog.id}`)); fetchData(); } }}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </Card>
                    ))}
                </div>}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
                    <DialogHeader><DialogTitle>{editingProgramme ? 'Edit' : 'New'} Programme</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-auto py-4 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Name *</Label><Input value={programmeName} onChange={e => setProgrammeName(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Tuition (Optional)</Label><Input type="number" value={programmeTuition} onChange={e => setProgrammeTuition(e.target.value)} /></div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><Label className="text-lg font-bold">Assigned Courses</Label>
                                <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
                                    <DialogTrigger asChild><Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Quick Create Course</Button></DialogTrigger>
                                    <DialogContent><form onSubmit={handleCreateCourse}>
                                        <DialogHeader><DialogTitle>New Course & Link</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <Input placeholder="Name" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required />
                                            <Input placeholder="Code" value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} required />
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input type="number" placeholder="Cost" value={newCourseCost} onChange={e => setNewCourseCost(e.target.value)} />
                                                <Input type="number" placeholder="Year" value={newCourseYear} onChange={e => setNewCourseYear(e.target.value)} />
                                            </div>
                                            <div className="flex items-center space-x-2 p-2 border rounded bg-muted/20">
                                                <Switch checked={separateInstance} onCheckedChange={setSeparateInstance} />
                                                <Label className="text-xs">Separate Instance per Intake</Label>
                                            </div>
                                        </div>
                                        <DialogFooter><Button type="submit" disabled={courseFormLoading}>Create & Link</Button></DialogFooter>
                                    </form></DialogContent>
                                </Dialog>
                            </div>
                            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 opacity-50"/><Input placeholder="Filter..." className="pl-8" value={courseSearchTerm} onChange={e => setCourseSearchTerm(e.target.value)} /></div>
                            <ScrollArea className="h-64 border rounded-md p-4">
                                <Accordion type="multiple" defaultValue={Object.keys(groupedCourses)}>
                                    {Object.entries(groupedCourses).map(([year, courses]) => (
                                        <AccordionItem key={year} value={year}>
                                            <AccordionTrigger className="text-sm font-bold">{year}</AccordionTrigger>
                                            <AccordionContent className="grid gap-2">
                                                {courses.map(c => (
                                                    <div key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
                                                        <Checkbox id={`c-${c.id}`} checked={!!selectedCourses[c.id]} onCheckedChange={() => setSelectedCourses(prev => ({...prev, [c.id]: !prev[c.id]}))} />
                                                        <Label htmlFor={`c-${c.id}`} className="text-sm cursor-pointer flex-1">
                                                            <span className="font-medium">{c.name}</span> <span className="opacity-50 font-mono text-xs">({c.code})</span>
                                                        </Label>
                                                    </div>
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleFormSubmit} disabled={formLoading}>Save Programme</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
