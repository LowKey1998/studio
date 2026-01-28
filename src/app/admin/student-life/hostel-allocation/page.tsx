
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Home, DoorOpen, User, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Hostel = {
    id: string;
    name: string;
    rooms?: Record<string, Room>;
};

type Room = {
    id: string;
    number: string;
    capacity: number;
    studentId?: string;
    studentName?: string;
};

type Student = {
    uid: string;
    name: string;
};

export default function HostelAllocationPage() {
    const [hostels, setHostels] = React.useState<Hostel[]>([]);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    
    // Dialog states
    const [isHostelDialogOpen, setIsHostelDialogOpen] = React.useState(false);
    const [hostelName, setHostelName] = React.useState('');
    const [isRoomDialogOpen, setIsRoomDialogOpen] = React.useState(false);
    const [selectedHostelId, setSelectedHostelId] = React.useState('');
    const [roomNumber, setRoomNumber] = React.useState('');
    const [roomCapacity, setRoomCapacity] = React.useState(1);

    const { toast } = useToast();

    React.useEffect(() => {
        const hostelsRef = ref(db, 'hostels');
        const unsubHostels = onValue(hostelsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setHostels(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const data = snapshot.val() || {};
            setStudents(Object.keys(data).filter(uid => data[uid].role === 'Student').map(uid => ({ uid, name: data[uid].name })));
        });

        return () => {
            unsubHostels();
            unsubUsers();
        };
    }, []);
    
    const handleSaveHostel = async () => {
        if (!hostelName) return;
        setFormLoading(true);
        try {
            await push(ref(db, 'hostels'), { name: hostelName });
            toast({ title: 'Hostel Created' });
            setHostelName('');
            setIsHostelDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: 'Error creating hostel' }) }
        finally { setFormLoading(false); }
    };

    const handleSaveRoom = async () => {
        if (!roomNumber || !selectedHostelId) return;
        setFormLoading(true);
        try {
            await push(ref(db, `hostels/${selectedHostelId}/rooms`), { number: roomNumber, capacity: roomCapacity });
            toast({ title: 'Room Added' });
            setRoomNumber('');
            setRoomCapacity(1);
            setIsRoomDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: 'Error adding room' }) }
        finally { setFormLoading(false); }
    };
    
    const handleAssignStudent = async (hostelId: string, roomId: string, studentId: string) => {
        try {
            const studentName = students.find(s => s.uid === studentId)?.name;
            await set(ref(db, `hostels/${hostelId}/rooms/${roomId}/studentId`), studentId);
            await set(ref(db, `hostels/${hostelId}/rooms/${roomId}/studentName`), studentName);
            toast({ title: 'Student Assigned' });
        } catch(e) {
             toast({ variant: 'destructive', title: 'Assignment Failed' });
        }
    };
    
     const handleRemoveStudent = async (hostelId: string, roomId: string) => {
        try {
            await remove(ref(db, `hostels/${hostelId}/rooms/${roomId}/studentId`));
            await remove(ref(db, `hostels/${hostelId}/rooms/${roomId}/studentName`));
            toast({ title: 'Student Removed from Room' });
        } catch(e) {
             toast({ variant: 'destructive', title: 'Failed to remove student' });
        }
    };


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Hostel Allocation</CardTitle>
                    <CardDescription>Manage hostel buildings, rooms, and student assignments.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isHostelDialogOpen} onOpenChange={setIsHostelDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Hostel</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Create New Hostel</DialogTitle></DialogHeader>
                            <Input placeholder="Hostel Name" value={hostelName} onChange={e => setHostelName(e.target.value)} />
                            <DialogFooter><Button onClick={handleSaveHostel} disabled={formLoading}>Save</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
                        <DialogTrigger asChild><Button variant="outline" disabled={hostels.length === 0}>Add Room</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add New Room</DialogTitle></DialogHeader>
                            <Select onValueChange={setSelectedHostelId}><SelectTrigger><SelectValue placeholder="Select Hostel..."/></SelectTrigger><SelectContent>{hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select>
                            <Input placeholder="Room Number (e.g., 101A)" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} />
                            <Input type="number" placeholder="Capacity" value={roomCapacity} onChange={e => setRoomCapacity(Number(e.target.value))} />
                            <DialogFooter><Button onClick={handleSaveRoom} disabled={formLoading}>Save Room</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-48" /> : (
                <Accordion type="multiple" className="w-full">
                    {hostels.map(hostel => (
                        <AccordionItem value={hostel.id} key={hostel.id}>
                            <AccordionTrigger className="text-lg font-semibold"><Home className="mr-2"/>{hostel.name}</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                {hostel.rooms ? Object.entries(hostel.rooms).map(([roomId, room]) => (
                                    <div key={roomId} className="flex items-center justify-between p-2 border rounded-md">
                                        <div className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-muted-foreground"/> Room {room.number}</div>
                                        <div className="flex items-center gap-2">
                                            {room.studentId ? (
                                                <>
                                                 <span className="text-sm font-medium">{room.studentName}</span>
                                                 <Button variant="ghost" size="icon" onClick={() => handleRemoveStudent(hostel.id, roomId)}><Trash2 className="h-4 w-4"/></Button>
                                                </>
                                            ): (
                                                <Select onValueChange={val => handleAssignStudent(hostel.id, roomId, val)}>
                                                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign student..."/></SelectTrigger>
                                                    <SelectContent>{students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-center text-muted-foreground p-4">No rooms added to this hostel yet.</p>}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                )}
            </CardContent>
        </Card>
    );
}
