'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

type ResearchProject = {
    id: string;
    title: string;
    leadResearcherName: string;
    proposalStatus?: 'Not Submitted' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
    proposalUrl?: string;
};

const statusOptions: ResearchProject['proposalStatus'][] = ['Not Submitted', 'Submitted', 'Under Review', 'Approved', 'Rejected'];

export default function ProposalSubmissionPage() {
    const [projects, setProjects] = React.useState<ResearchProject[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'researchProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            setProjects(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id], proposalStatus: snapshot.val()[id].proposalStatus || 'Not Submitted' })) : []);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleStatusChange = async (projectId: string, status: ResearchProject['proposalStatus']) => {
        try {
            await update(ref(db, `researchProjects/${projectId}`), { proposalStatus: status });
            toast({ title: "Status Updated" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Update Failed" });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Research Proposal Submission Workflow</CardTitle>
                <CardDescription>Track the status of submitted research proposals.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Lead Researcher</TableHead>
                            <TableHead>Proposal</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.map(project => (
                            <TableRow key={project.id}>
                                <TableCell>{project.title}</TableCell>
                                <TableCell>{project.leadResearcherName}</TableCell>
                                <TableCell>
                                    {project.proposalUrl ? (
                                        <Button asChild variant="outline" size="sm">
                                            <a href={project.proposalUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>Download</a>
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">Not Submitted</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                     <Select value={project.proposalStatus} onValueChange={(value) => handleStatusChange(project.id, value as any)}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
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
