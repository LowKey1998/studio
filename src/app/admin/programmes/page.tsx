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
import { ScrollArea } from '@/components/ui/scroll-area';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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

type CurrentAdmin = {
    name: string;
    id: string;
}

export default function ProgrammesPage() {
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [lecturers, setLecturers] = React.useState<Lecturer[]>([]);
    const [billingPolicy, setBillingPolicy] = React.useState<'course' | 'semester' | 'unknown'>('course');
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    
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

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
              const userData = snapshot.val();
              setCurrentAdmin({ name: userData.name, id: userData.id });
            }
          }
        });
        return () => unsubscribe();
    }, []);
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            onValue(ref(db, 'settings/institution'), (snapshot) => {
                if (snapshot.exists()) setBillingPolicy(snapshot.val().billingPolicy || 'course');
            });

            onValue(ref(db, 'users'), (snapshot) => {
                const lecturersList: Lecturer[] = [];
                if (snapshot.exists()) {
                    const usersData = snapshot.val();
                    Object.keys(usersData).forEach(uid => {
                        if (usersData[uid].role === 'Staff' && (usersData[uid].subRoles?.includes('Lecturer') || usersData[uid].subRoleNames?.includes('Lecturer'))) {
                            lecturersList.push({ uid, name: usersData[uid].name });
                        }
                    });
                }
                setLecturers(lecturersList);
            });

            onValue(ref(db, 'courses'), (snapshot) => {
                setAllCourses(snapshot.exists() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : []);
            });

            onValue(ref(db, 'programmes'), (snapshot) => {
                setProgrammes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
                setLoading(false);
            });
        } catch(e) {
            console.error(e);
            toast({ variant: "destructive", title: "Load Failed" });
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
            setIsDialogOpen(false);
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
            setIsCourseDialogOpen(false);
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
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-headline">Academic Programmes</CardTitle>
                            <CardDescription>Manage academic programmes and curriculum catalogs.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild><Link href="/admin/courses"><BookCopy className="mr-2 h-4 w-4" /> Manage Course Catalog</Link></Button>
                            <Button onClick={() => { setEditingProgramme(null); setProgrammeName(''); setProgrammeTuition(''); setSelectedCourses({}); setIsDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Programme</Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl"/>) : 
                programmes.map(prog => (
                    <Card key={prog.id} className="flex flex-col justify-between shadow-md hover:shadow-xl transition-all border-t-4 border-t-primary">
                        <CardHeader>
                            <div className="space-y-1">
                                <CardTitle className="text-lg leading-tight">{prog.name}</CardTitle>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-primary">
                                        {prog.tuitionFee ? `ZMW ${prog.tuitionFee.toLocaleString()}` : 'Fee Not Set'}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest opacity-70">
                                        {billingPolicy === 'semester' ? 'Flat Semester Fee' : 'Pay per Course'}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <Badge variant="secondary" className="mt-2">
                                {Object.keys(prog.courseIds || {}).length} Mapped Courses
                            </Badge>
                        </CardContent>
                        <CardFooter className="flex gap-2 pt-0">
                            <Button variant="outline" className="flex-1" onClick={() => { setEditingProgramme(prog); setProgrammeName(prog.name); setProgrammeTuition(prog.tuitionFee?.toString() || ''); setSelectedCourses(prog.courseIds || {}); setIsDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4"/>Edit</Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => { if(confirm("Permanently delete this programme?")) { await remove(ref(db, `programmes/${prog.id}`)); } }}><Trash2 className="h-4 w-4"/></Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{editingProgramme ? 'Edit' : 'New'} Programme</DialogTitle>
                        <DialogDescription>Define the curriculum and fee structure for this academic track.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Programme Name *</Label><Input value={programmeName} onChange={e => setProgrammeName(e.target.value)} placeholder="e.g., Bachelor of Science in Nursing"/></div>
                            <div className="space-y-1">
                                <Label>Tuition Fee (ZMW)</Label>
                                <Input type="number" value={programmeTuition} onChange={e => setProgrammeTuition(e.target.value)} placeholder="e.g., 5000" />
                                <p className="text-[10px] text-muted-foreground italic">Required for 'Flat Semester Fee' billing.</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-bold">Curriculum Mapping</Label>
                                <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
                                    <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8"><PlusCircle className="mr-2 h-4 w-4"/>Quick Create Course</Button></DialogTrigger>
                                    <DialogContent><form onSubmit={handleCreateCourse}>
                                        <DialogHeader><DialogTitle>New Course & Link</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <Input placeholder="Course Name" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required />
                                            <Input placeholder="Course Code" value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} required />
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input type="number" placeholder="Cost" value={newCourseCost} onChange={e => setNewCourseCost(e.target.value)} />
                                                <Input type="number" placeholder="Year" value={newCourseYear} onChange={e => setNewCourseYear(e.target.value)} />
                                            </div>
                                            <div className="flex items-start space-x-2 p-2 border rounded bg-muted/20">
                                                <Switch checked={separateInstance} onCheckedChange={setSeparateInstance} className="mt-1" />
                                                <div className="space-y-0.5">
                                                    <Label className="text-xs font-bold">Cohort-Specific Timetabling</Label>
                                                    <p className="text-[9px] text-muted-foreground leading-tight italic">Enable if intakes should have independent class sessions.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter><Button type="submit" disabled={courseFormLoading}>Create & Link</Button></DialogFooter>
                                    </form></DialogContent>
                                </Dialog>
                            </div>
                            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-50"/><Input placeholder="Search catalog..." className="pl-8" value={courseSearchTerm} onChange={e => setCourseSearchTerm(e.target.value)} /></div>
                            <ScrollArea className="h-64 border rounded-md p-4 bg-muted/5">
                                <Accordion type="multiple" defaultValue={Object.keys(groupedCourses)}>
                                    {Object.entries(groupedCourses).map(([year, courses]) => (
                                        <AccordionItem key={year} value={year} className="border-none">
                                            <AccordionTrigger className="font-bold text-sm py-2 hover:no-underline">{year}</AccordionTrigger>
                                            <AccordionContent className="grid gap-2 pt-2">
                                                {courses.map(c => (
                                                    <div key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-colors">
                                                        <Checkbox id={`c-${c.id}`} checked={!!selectedCourses[c.id]} onCheckedChange={() => setSelectedCourses(prev => ({...prev, [c.id]: !prev[c.id]}))} />
                                                        <Label htmlFor={`c-${c.id}`} className="text-sm cursor-pointer flex-1">
                                                            <span className="font-medium">{c.name}</span> <span className="opacity-50 font-mono text-xs ml-2">({c.code})</span>
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
                    <DialogFooter className="border-t pt-4"><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button onClick={handleFormSubmit} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Programme</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
