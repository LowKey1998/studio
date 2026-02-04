
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Target, PlusCircle, Trash2, Loader2, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, onValue, push, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Campaign = {
    id: string;
    name: string;
    leads: number;
    applicants: number;
    enrollments: number;
};

export default function CampaignTrackingPage() {
    const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [name, setName] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const campaignsRef = ref(db, 'admissions/campaigns');
        const unsub = onValue(campaignsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setCampaigns(Object.keys(data).map(id => ({
                id,
                ...data[id],
                leads: data[id].leads || 0,
                applicants: data[id].applicants || 0,
                enrollments: data[id].enrollments || 0,
            })));
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const handleSaveCampaign = async () => {
        if (!name) return;
        setSaving(true);
        try {
            await push(ref(db, 'admissions/campaigns'), { name, leads: 0, applicants: 0, enrollments: 0 });
            toast({ title: "Campaign Added" });
            setName('');
            setIsDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add campaign.' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteCampaign = async (campaignId: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(ref(db, `admissions/campaigns/${campaignId}`));
        toast({ title: "Campaign removed" });
    };

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-orange-500 rounded-lg p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                    <h4 className="font-bold text-orange-800">Notice: Premium Feature</h4>
                    <p className="text-orange-700 text-sm">
                        Campaign Tracking is a premium module. Advanced attribution analytics and third-party tracking pixel integrations are available upon request.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex-row items-start justify-between">
                    <div>
                        <CardTitle>Campaign Tracking</CardTitle>
                        <CardDescription>Monitor the performance of your marketing and admissions campaigns.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Campaign Name</TableHead>
                                <TableHead>Leads</TableHead>
                                <TableHead>Applicants</TableHead>
                                <TableHead>Enrollments</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {campaigns.length > 0 ? campaigns.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell>{c.leads}</TableCell>
                                    <TableCell>{c.applicants}</TableCell>
                                    <TableCell>{c.enrollments}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCampaign(c.id)} disabled>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                        No campaign data available.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
