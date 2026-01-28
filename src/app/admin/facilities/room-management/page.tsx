'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Room = {
    id: string;
    name: string;
    capacity: number;
};

export default function RoomManagementPage() {
    const [rooms, setRooms] = React.useState<Room[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [capacity, setCapacity] = React.useState<number | ''>('');

    const { toast } = useToast();

    React.useEffect(() => {
        const roomsRef = ref(db, 'settings/rooms');
        const unsub = onValue(roomsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setRooms(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setName('');
        setCapacity('');
    };

    const handleSaveRoom = async () => {
        if (!name || !capacity) {
            toast({ variant: 'destructive', title: 'Name and capacity are required.' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'settings/rooms'), { name, capacity: Number(capacity) });
            toast({ title: "Room Added" });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add room.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRoom = async (id: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(ref(db, `settings/rooms/${id}`));
        toast({ title: "Room removed" });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>Room Management</CardTitle>
                    <CardDescription>Manage all classrooms, lecture halls, and labs available for scheduling.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4"/>Add Room</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Room</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                           <div className="space-y-1"><Label>Room Name / Number</Label><Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., Lecture Hall 1, Lab 2B"/></div>
                           <div className="space-y-1"><Label>Capacity</Label><Input type="number" value={capacity} onChange={e => setCapacity(e.target.value === '' ? '' : Number(e.target.value))} required placeholder="e.g., 50"/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" onClick={resetForm}>Cancel</Button></DialogClose>
                            <Button onClick={handleSaveRoom} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Room</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Room Name</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow>
                        : rooms.length > 0 ? rooms.map(room => (
                            <TableRow key={room.id}>
                                <TableCell>{room.name}</TableCell>
                                <TableCell>{room.capacity}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">No rooms created yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
