
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Calendar, PlusCircle, CheckCircle2, MessageSquare, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Applicant = {
    id: string;
    name: string;
    email: string;
    phone: string;
    resumeUrl: string;
    dateApplied: string;
    status: 'Received' | 'Reviewed' | 'Interviewing' | 'Hired' | 'Rejected';
    interviewDate?: string;
    interviewNotes?: string;
    interviewScore?: number;
};

type Vacancy = {
    id: string;
    title: string;
    status: 'Open' | 'Closed';
    applicants?: Record<string, Applicant>;
};

export default function InterviewSelectionPage() {
    const [vacancies, setVacancies] = React.useState<Vacancy[]>([]);
    const [selectedVacancy, setSelectedVacancy] = React.useState<Vacancy | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState<string | null>(null); // Stores applicant ID
    const [interviewDate, setInterviewDate] = React.useState<Date | undefined>();
    const [interviewNotes, setInterviewNotes] = React.useState('');
    const [interviewScore, setInterviewScore] = React.useState<number | undefined>();

    const { toast } = useToast();

    React.useEffect(() => {
        const vacanciesRef = ref(db, 'vacancies');
        const unsubscribe = onValue(vacanciesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const openVacancies = Object.keys(data)
                    .map(key => ({ ...data[key], id: key }))
                    .filter(v => v.status === 'Open');
                setVacancies(openVacancies);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSelectVacancy = (vacancyId: string) => {
        const vacancy = vacancies.find(v => v.id === vacancyId);
        setSelectedVacancy(vacancy || null);
    };

    const handleOpenDialog = (applicant: Applicant) => {
        setInterviewDate(applicant.interviewDate ? parseISO(applicant.interviewDate) : undefined);
        setInterviewNotes(applicant.interviewNotes || '');
        setInterviewScore(applicant.interviewScore);
        setDialogOpen(applicant.id);
    };
    
    const handleCloseDialog = () => {
        setDialogOpen(null);
        setInterviewDate(undefined);
        setInterviewNotes('');
        setInterviewScore(undefined);
    };

    const handleSaveInterviewDetails = async () => {
        if (!selectedVacancy || !dialogOpen) return;
        
        try {
            const applicantRef = ref(db, `vacancies/${selectedVacancy.id}/applicants/${dialogOpen}`);
            await set(applicantRef, {
                ...selectedVacancy.applicants?.[dialogOpen],
                status: 'Interviewing',
                interviewDate: interviewDate ? format(interviewDate, 'yyyy-MM-dd') : null,
                interviewNotes,
                interviewScore,
            });
            toast({ title: 'Interview details saved.' });
            handleCloseDialog();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to save details.' });
        }
    };
    
    const applicants = selectedVacancy?.applicants ? Object.values(selectedVacancy.applicants) : [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Interview & Selection</CardTitle>
                <CardDescription>Manage the interview process for open vacancies.</CardDescription>
                <div className="pt-2">
                    <Select onValueChange={handleSelectVacancy} disabled={loading || vacancies.length === 0}>
                        <SelectTrigger className="max-w-sm">
                            <SelectValue placeholder="Select a vacancy..." />
                        </SelectTrigger>
                        <SelectContent>
                            {vacancies.map(v => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {selectedVacancy ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Applicant</TableHead>
                            <TableHead>Resume</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Interview Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {applicants.map(app => (
                            <TableRow key={app.id}>
                                <TableCell>{app.name}</TableCell>
                                <TableCell><Button asChild variant="link" className="p-0"><a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4 mr-2"/>View Resume</a></Button></TableCell>
                                <TableCell>{app.status}</TableCell>
                                <TableCell>{app.interviewDate ? format(parseISO(app.interviewDate), 'PPP') : 'Not Scheduled'}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" onClick={() => handleOpenDialog(app)}>Manage Interview</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                ) : <p className="text-muted-foreground">Select a vacancy to view applicants.</p>}

                 <Dialog open={!!dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Manage Interview for {selectedVacancy?.applicants?.[dialogOpen!]?.name}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Interview Date</Label>
                                    <Popover><PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start"><Calendar className="h-4 w-4 mr-2"/>{interviewDate ? format(interviewDate, 'PPP') : "Select Date"}</Button>
                                    </PopoverTrigger><PopoverContent><CalendarComponent mode="single" selected={interviewDate} onSelect={setInterviewDate} /></PopoverContent></Popover>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Interview Score (out of 100)</Label>
                                    <Input type="number" value={interviewScore || ''} onChange={(e) => setInterviewScore(Number(e.target.value))}/>
                                 </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Interview Notes & Feedback</Label>
                                <Textarea value={interviewNotes} onChange={(e) => setInterviewNotes(e.target.value)} rows={10}/>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                            <Button onClick={handleSaveInterviewDetails}>Save Details</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
