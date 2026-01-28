'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Project = {
    id: string;
    title: string;
    submittedByName: string;
    ipType?: 'Patent' | 'Copyright' | 'Trademark';
    ipStatus?: 'None' | 'Pending' | 'Filed' | 'Granted' | 'Rejected';
};

const ipTypeOptions: Project['ipType'][] = ['Patent', 'Copyright', 'Trademark'];
const ipStatusOptions: Project['ipStatus'][] = ['None', 'Pending', 'Filed', 'Granted', 'Rejected'];

export default function IPTrackerPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            const approvedProjects: Project[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const id in data) {
                    if (data[id].status === 'Approved') {
                        approvedProjects.push({
                            id,
                            ...data[id],
                            ipStatus: data[id].ipStatus || 'None'
                        });
                    }
                }
            }
            setProjects(approvedProjects);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleUpdate = async (projectId: string, field: 'ipType' | 'ipStatus', value: string) => {
        try {
            await update(ref(db, `innovationProjects/${projectId}`), { [field]: value });
            toast({ title: "IP Status Updated" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Update Failed" });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Intellectual Property Tracker</CardTitle>
                <CardDescription>Track the status of IP registrations for approved student innovations.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>IP Type</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.map(project => (
                            <TableRow key={project.id}>
                                <TableCell>{project.title}</TableCell>
                                <TableCell>{project.submittedByName}</TableCell>
                                <TableCell>
                                     <Select value={project.ipType} onValueChange={(value) => handleUpdate(project.id, 'ipType', value as any)}>
                                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select type..." /></SelectTrigger>
                                        <SelectContent>{ipTypeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                     <Select value={project.ipStatus} onValueChange={(value) => handleUpdate(project.id, 'ipStatus', value as any)}>
                                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{ipStatusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
