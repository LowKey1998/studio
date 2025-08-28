'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ApplicantLead = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status: 'New' | 'Contacted' | 'Interviewing' | 'Enrolled' | 'Disqualified';
    interviewDate?: string;
    interviewTime?: string;
};


export default function InterviewSchedulingPage() {
    const [leads, setLeads] = React.useState<ApplicantLead[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState<string | null>(null); // Stores lead ID
    const [interviewDate, setInterviewDate] = React.useState<Date | undefined>();
    const [interviewTime, setInterviewTime] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const leadsRef = ref(db, 'admissions/leads');
        const unsubscribe = onValue(leadsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setLeads(Object.keys(data).map(key => ({ ...data[key], id: key })));
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleOpenDialog = (lead: ApplicantLead) => {
        setInterviewDate(lead.interviewDate ? parseISO(lead.interviewDate) : undefined);
        setInterviewTime(lead.interviewTime || '');
        setDialogOpen(lead.id);
    };

    const handleCloseDialog = () => {
        setDialogOpen(null);
        setInterviewDate(undefined);
        setInterviewTime('');
    };

    const handleScheduleInterview = async () => {
        if (!dialogOpen) return;
        
        try {
            const leadRef = ref(db, `admissions/leads/${dialogOpen}`);
            await set(leadRef, {
                ...leads.find(l => l.id === dialogOpen),
                status: 'Interviewing',
                interviewDate: interviewDate ? format(interviewDate, 'yyyy-MM-dd') : null,
                interviewTime: interviewTime,
            });
            toast({ title: 'Interview Scheduled', description: `An interview has been scheduled.` });
            handleCloseDialog();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to save details.' });
        }
    };
    
    const leadsToSchedule = leads.filter(l => l.status === 'New' || l.status === 'Contacted' || l.status === 'Interviewing');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Interview Scheduling</CardTitle>
                <CardDescription>Schedule and manage interviews with prospective students.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Applicant</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Interview</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                        leadsToSchedule.map(lead => (
                            <TableRow key={lead.id}>
                                <TableCell>{lead.name}</TableCell>
                                <TableCell>{lead.email || lead.phone}</TableCell>
                                <TableCell>{lead.status}</TableCell>
                                <TableCell>{lead.interviewDate ? `${format(parseISO(lead.interviewDate), 'PPP')} at ${lead.interviewTime}` : 'Not Scheduled'}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" onClick={() => handleOpenDialog(lead)}>Schedule Interview</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Dialog open={!!dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Schedule Interview for {leads.find(l => l.id === dialogOpen)?.name}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-1">
                                <Label>Interview Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start"><CalendarIcon className="h-4 w-4 mr-2"/>{interviewDate ? format(interviewDate, 'PPP') : "Select Date"}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent><Calendar mode="single" selected={interviewDate} onSelect={setInterviewDate} /></PopoverContent>
                                </Popover>
                            </div>
                             <div className="space-y-1">
                                <Label>Interview Time</Label>
                                <Input type="time" value={interviewTime} onChange={e => setInterviewTime(e.target.value)} />
                             </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                            <Button onClick={handleScheduleInterview}>Save Schedule</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
