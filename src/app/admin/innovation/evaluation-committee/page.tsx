
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, UserCog, Trash2, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type CommitteeMember = {
    id: string;
    userId: string;
    userName: string;
    role: string;
};

type User = {
    uid: string;
    name: string;
    role: 'Staff' | 'Admin';
};

export default function EvaluationCommitteePage() {
    const [committee, setCommittee] = React.useState<CommitteeMember[]>([]);
    const [staff, setStaff] = React.useState<User[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState('');
    const [memberRole, setMemberRole] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const committeeRef = ref(db, 'evaluationCommittee');
        const unsubCommittee = onValue(committeeRef, (snapshot) => {
            setCommittee(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                setStaff(Object.keys(usersData)
                    .filter(uid => usersData[uid].role === 'Staff' || usersData[uid].role === 'Admin')
                    .map(uid => ({ uid, name: usersData[uid].name, role: usersData[uid].role }))
                );
            }
        });

        return () => {
            unsubCommittee();
            unsubUsers();
        };
    }, []);

    const handleAddMember = async () => {
        if (!selectedUserId || !memberRole) {
            toast({ variant: 'destructive', title: 'Please select a user and assign a role.' });
            return;
        }
        setSaving(true);
        try {
            const user = staff.find(s => s.uid === selectedUserId);
            if (!user) return;
            
            await push(ref(db, 'evaluationCommittee'), {
                userId: user.uid,
                userName: user.name,
                role: memberRole
            });
            toast({ title: 'Member Added' });
            setIsDialogOpen(false);
            setSelectedUserId('');
            setMemberRole('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add member' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        await remove(ref(db, `evaluationCommittee/${id}`));
        toast({ title: 'Member removed' });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Innovation Evaluation Committee</CardTitle>
                    <CardDescription>Manage members of the committee responsible for evaluating projects.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Add Member</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add Committee Member</DialogTitle></DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-1">
                                <Label>Staff Member</Label>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                    <SelectTrigger><SelectValue placeholder="Select a staff member..." /></SelectTrigger>
                                    <SelectContent>{staff.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Role</Label>
                                <Input placeholder="e.g., Head of Innovation" value={memberRole} onChange={e => setMemberRole(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleAddMember} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Member
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow>
                        : committee.map(member => (
                            <TableRow key={member.id}>
                                <TableCell>{member.userName}</TableCell>
                                <TableCell>{member.role}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(member.id)}>Remove</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
