'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, ExternalLink, Users, Calendar, Trash2, Eye, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { postJobVacancy } from '@/ai/flows/post-job-vacancy';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

type Vacancy = {
    id: string;
    title: string;
    description: string;
    department: string;
    type: 'Full-time' | 'Part-time' | 'Contract';
    status: 'Open' | 'Closed';
    datePosted: string;
    applicants?: Record<string, Applicant>;
};

type Applicant = {
    id: string;
    name: string;
    email: string;
    phone: string;
    resumeUrl: string;
    dateApplied: string;
    status: 'Received' | 'Reviewed' | 'Interviewing' | 'Hired' | 'Rejected';
};

export default function VacanciesPage() {
    const [vacancies, setVacancies] = React.useState<Vacancy[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isApplicantsSheetOpen, setIsApplicantsSheetOpen] = React.useState(false);
    const [selectedVacancy, setSelectedVacancy] = React.useState<Vacancy | null>(null);

    // Form states
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [type, setType] = React.useState<'Full-time' | 'Part-time' | 'Contract'>('Full-time');
    const [syndicate, setSyndicate] = React.useState(false);

    // Interview Dialog states
    const [isInterviewDialogOpen, setIsInterviewDialogOpen] = React.useState(false);
    const [interviewApplicant, setInterviewApplicant] = React.useState<Applicant | null>(null);
    const [interviewDate, setInterviewDate] = React.useState<Date | undefined>();

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onValue(ref(db, 'vacancies'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: Vacancy[] = Object.keys(data).map(key => ({ ...data[key], id: key }));
                setVacancies(list.sort((a, b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime()));
            } else {
                setVacancies([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setTitle(''); setDescription(''); setDepartment(''); setType('Full-time'); setSyndicate(false);
    };

    const handleCreateVacancy = async () => {
        if (!title || !description || !department) {
            toast({ variant: 'destructive', title: 'Missing fields' });
            return;
        }
        setActionLoading(true);
        try {
            const result = await postJobVacancy({ title, description, department, type, syndicate });
            toast({ title: "Vacancy Posted", description: result });
            resetForm();
            setIsCreateDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Failed to post vacancy", description: e.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleScheduleInterview = async () => {
        if (!interviewApplicant || !selectedVacancy || !interviewDate) {
            toast({ variant: 'destructive', title: 'Missing interview details' });
            return;
        }
        
        setActionLoading(true);
        try {
            await set(ref(db, `vacancies/${selectedVacancy.id}/applicants/${interviewApplicant.id}/status`), 'Interviewing');
            
            toast({
                title: "Interview Scheduled!",
                description: `An interview with ${interviewApplicant.name} has been set for ${format(interviewDate, 'PPP')}.`,
             });
            
            setIsInterviewDialogOpen(false);
            setInterviewApplicant(null);
            setInterviewDate(undefined);
        } catch(e: any) {
             toast({ variant: 'destructive', title: "Scheduling Failed", description: e.message });
        } finally { 
            setActionLoading(false);
        }
    };

    const handleDeleteVacancy = async (vacancyId: string) => {
        if (!window.confirm("Are you sure you want to delete this vacancy and all associated applications?")) {
            return;
        }
        try {
            await remove(ref(db, `vacancies/${vacancyId}`));
            toast({ title: 'Vacancy Deleted' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">Manage Vacancies</CardTitle>
                        <CardDescription>Create, post, and review job openings and applications.</CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Create Vacancy</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>New Job Vacancy</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Job Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
                                    <div className="space-y-1"><Label>Department</Label><Input value={department} onChange={e => setDepartment(e.target.value)} /></div>
                                </div>
                                <div className="space-y-1"><Label>Job Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={8}/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Employment Type</Label>
                                        <Select value={type} onValueChange={v => setType(v as any)}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Full-time">Full-time</SelectItem>
                                                <SelectItem value="Part-time">Part-time</SelectItem>
                                                <SelectItem value="Contract">Contract</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="syndicate" checked={syndicate} onCheckedChange={c => setSyndicate(!!c)}/>
                                            <Label htmlFor="syndicate">Post to external job sites</Label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleCreateVacancy} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="mr-2 h-4 animate-spin"/>}Create & Post
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-48 w-full"/> : (
                        <Tabs defaultValue="Open">
                            <TabsList>
                                <TabsTrigger value="Open">Open</TabsTrigger>
                                <TabsTrigger value="Closed">Closed</TabsTrigger>
                            </TabsList>
                            <TabsContent value="Open" className="mt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                {vacancies.filter(v => v.status === 'Open').map(v => (
                                    <Card key={v.id}>
                                        <CardHeader>
                                            <CardTitle>{v.title}</CardTitle>
                                            <CardDescription>{v.department} &middot; {v.type}</CardDescription>
                                        </CardHeader>
                                        <CardFooter className="flex justify-between">
                                            <Button variant="ghost" onClick={() => { setSelectedVacancy(v); setIsApplicantsSheetOpen(true); }}>
                                                <Users className="mr-2 h-4"/>{Object.keys(v.applicants || {}).length} Applicants
                                            </Button>
                                            <div className="flex gap-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/vacancies/${v.id}`} target="_blank">
                                                    <ExternalLink className="mr-2 h-4"/>View
                                                </Link>
                                            </Button>
                                             <Button variant="destructive" size="icon" onClick={() => handleDeleteVacancy(v.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                ))}
                                {vacancies.filter(v => v.status === 'Open').length === 0 && <p className="text-sm text-muted-foreground p-4">No open vacancies.</p>}
                                </div>
                            </TabsContent>
                             <TabsContent value="Closed" className="mt-4">
                                <p className="text-sm text-muted-foreground">No closed vacancies to show.</p>
                             </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isApplicantsSheetOpen} onOpenChange={setIsApplicantsSheetOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Applicants for {selectedVacancy?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Applicant</TableHead>
                                    <TableHead>Applied On</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {selectedVacancy && selectedVacancy.applicants && Object.values(selectedVacancy.applicants).length > 0 ? Object.values(selectedVacancy.applicants).map(app => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        <div className="font-medium">{app.name}</div>
                                        <div className="text-sm text-muted-foreground">{app.email}</div>
                                    </TableCell>
                                    <TableCell>{format(parseISO(app.dateApplied), 'PPP')}</TableCell>
                                    <TableCell><Badge>{app.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="outline" size="sm" asChild>
                                                <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"><Eye className="mr-2 h-4"/>Resume</a>
                                            </Button>
                                            <Button size="sm" onClick={() => { setInterviewApplicant(app); setIsInterviewDialogOpen(true); }}>
                                                <Calendar className="mr-2 h-4"/>Interview
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No applicants yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

             <Dialog open={isInterviewDialogOpen} onOpenChange={setIsInterviewDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Schedule Interview</DialogTitle>
                        <DialogDescription>Schedule an interview with {interviewApplicant?.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">
                                    <CalendarIcon className="mr-2 h-4"/>
                                    {interviewDate ? format(interviewDate, 'PPP') : "Select Date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent>
                                <CalendarComponent mode="single" selected={interviewDate} onSelect={setInterviewDate} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleScheduleInterview} disabled={actionLoading}>
                            {actionLoading && <Loader2 className="mr-2 h-4"/>}Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        </div>
    );
}
