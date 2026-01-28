
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Star, Loader2, CalendarIcon, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type Staff = {
    uid: string;
    name: string;
    subRoles?: string[];
};

type Review = {
    id: string;
    staffUid: string;
    staffName: string;
    reviewDate: string;
    notes: string;
    status: 'Scheduled' | 'Completed';
};

export default function PerformancePage() {
    const [reviews, setReviews] = React.useState<Review[]>([]);
    const [staff, setStaff] = React.useState<Staff[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);
    const [viewingReview, setViewingReview] = React.useState<Review | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);
    const [selectedStaffUid, setSelectedStaffUid] = React.useState('');
    const [reviewDate, setReviewDate] = React.useState<Date | undefined>();
    const [notes, setNotes] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const reviewsRef = ref(db, 'performanceReviews');
        const unsubReviews = onValue(reviewsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const list: Review[] = [];
            for (const staffId in data) {
                for (const reviewId in data[staffId]) {
                    list.push({ id: reviewId, staffUid: staffId, ...data[staffId][reviewId] });
                }
            }
            setReviews(list.sort((a,b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime()));
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val() || {};
            setStaff(
                Object.keys(usersData)
                .filter(uid => usersData[uid].role === 'Staff')
                .map(uid => ({ uid, ...usersData[uid] }))
            );
        });

        return () => {
            unsubReviews();
            unsubUsers();
        };
    }, []);

    const resetForm = () => {
        setSelectedStaffUid('');
        setReviewDate(undefined);
        setNotes('');
    };
    
    const handleScheduleReview = async () => {
        if (!selectedStaffUid || !reviewDate) {
            toast({ variant: 'destructive', title: 'Staff and date are required.' });
            return;
        }
        setFormLoading(true);
        try {
            const staffMember = staff.find(s => s.uid === selectedStaffUid);
            if (!staffMember) throw new Error("Selected staff not found.");

            const newReviewRef = push(ref(db, `performanceReviews/${selectedStaffUid}`));
            await set(newReviewRef, {
                staffName: staffMember.name,
                reviewDate: format(reviewDate, 'yyyy-MM-dd'),
                notes,
                status: 'Scheduled',
            });
            toast({ title: 'Review Scheduled' });
            setIsDialogOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Scheduling failed', description: error.message });
        } finally {
            setFormLoading(false);
        }
    };


    return (
        <>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Performance Appraisals</CardTitle>
                    <CardDescription>Schedule and manage staff performance reviews.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4"/> Schedule Review</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Performance Review</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1">
                                <Label>Staff Member</Label>
                                <Select value={selectedStaffUid} onValueChange={setSelectedStaffUid}>
                                    <SelectTrigger><SelectValue placeholder="Select staff..."/></SelectTrigger>
                                    <SelectContent>{staff.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Review Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4"/>{reviewDate ? format(reviewDate, 'PPP') : "Select date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent><Calendar mode="single" selected={reviewDate} onSelect={setReviewDate}/></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <Label>Notes (Optional)</Label>
                                <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleScheduleReview} disabled={formLoading}>{formLoading && <Loader2 className="mr-2"/>}Schedule</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Review Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                        : reviews.map(review => (
                             <TableRow key={review.id}>
                                <TableCell>{review.staffName}</TableCell>
                                <TableCell>{format(new Date(review.reviewDate), 'PPP')}</TableCell>
                                <TableCell>{review.status}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => { setViewingReview(review); setIsViewDialogOpen(true); }}>
                                        <Eye className="mr-2 h-4 w-4"/> View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Review for {viewingReview?.staffName}</DialogTitle>
                    <DialogDescription>
                        Date: {viewingReview && format(new Date(viewingReview.reviewDate), 'PPP')}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 whitespace-pre-wrap">
                    {viewingReview?.notes || "No notes were recorded for this review."}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button>Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
