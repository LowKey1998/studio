
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, UserPlus, CheckCircle2, Trash2, Edit, Check, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

type OnboardingTask = {
    id: string;
    text: string;
};

type OnboardingTemplate = {
    id: string;
    name: string;
    tasks: Record<string, { text: string }>;
};

type StaffMember = {
    uid: string;
    name: string;
    onboardingStatus?: {
        templateId: string;
        templateName: string;
        progress: number;
        completedTasks: Record<string, boolean>;
    }
};

export default function OnboardingPage() {
    const [templates, setTemplates] = React.useState<OnboardingTemplate[]>([]);
    const [staff, setStaff] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Template Dialog State
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<OnboardingTemplate | null>(null);
    const [templateName, setTemplateName] = React.useState('');
    const [tasks, setTasks] = React.useState<OnboardingTask[]>([]);

    // Assign Dialog State
    const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
    const [selectedStaffUid, setSelectedStaffUid] = React.useState('');
    const [selectedTemplateId, setSelectedTemplateId] = React.useState('');

    const [formLoading, setFormLoading] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const templatesRef = ref(db, 'onboardingTemplates');
        const unsubTemplates = onValue(templatesRef, (snapshot) => {
            setTemplates(snapshot.exists() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...(data as any) })) : []);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const users = snapshot.val();
                setStaff(Object.entries(users).filter(([, user]: [string, any]) => user.role === 'Staff').map(([uid, user]: [string, any]) => ({ uid, name: user.name, onboardingStatus: user.onboardingStatus })));
            }
             setLoading(false);
        });

        return () => { unsubTemplates(); unsubUsers(); };
    }, []);
    
    const resetTemplateForm = () => {
        setEditingTemplate(null); setTemplateName(''); setTasks([{ id: `new-${Date.now()}`, text: '' }]);
    };
    
    const openTemplateDialog = (template: OnboardingTemplate | null) => {
        if (template) {
            setEditingTemplate(template);
            setTemplateName(template.name);
            setTasks(template.tasks ? Object.entries(template.tasks).map(([id, task]) => ({ id, text: task.text })) : [{ id: `new-${Date.now()}`, text: '' }]);
        } else {
            resetTemplateForm();
        }
        setIsTemplateDialogOpen(true);
    };

    const handleTaskChange = (id: string, text: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));
    };

    const addTask = () => {
        setTasks(prev => [...prev, { id: `new-${Date.now()}`, text: '' }]);
    };

    const removeTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };
    
    const handleSaveTemplate = async () => {
        if (!templateName.trim() || tasks.some(t => !t.text.trim())) {
            toast({ variant: 'destructive', title: 'Name and all task fields are required.' }); return;
        }
        setFormLoading(true);
        try {
            const tasksData: Record<string, { text: string }> = {};
            tasks.forEach(task => {
                const taskId = task.id.startsWith('new-') ? push(ref(db)).key! : task.id;
                tasksData[taskId] = { text: task.text };
            });

            const templateData = { name: templateName, tasks: tasksData };

            if (editingTemplate) {
                await update(ref(db, `onboardingTemplates/${editingTemplate.id}`), templateData);
                toast({ title: 'Template Updated' });
            } else {
                await push(ref(db, 'onboardingTemplates'), templateData);
                toast({ title: 'Template Created' });
            }
            resetTemplateForm();
            setIsTemplateDialogOpen(false);
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Failed to save template', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleAssignTemplate = async () => {
        if (!selectedStaffUid || !selectedTemplateId) {
            toast({ variant: 'destructive', title: 'Please select a staff member and a template.'}); return;
        }
        setFormLoading(true);
        const template = templates.find(t => t.id === selectedTemplateId);
        if (!template) {
            toast({ variant: 'destructive', title: 'Template not found.'});
            setFormLoading(false);
            return;
        }
        try {
            const status = {
                templateId: selectedTemplateId,
                templateName: template.name,
                progress: 0,
                completedTasks: {}
            };
            await update(ref(db, `users/${selectedStaffUid}`), { onboardingStatus: status });
            toast({ title: 'Onboarding Started', description: `Assigned "${template.name}" checklist.`});
            setIsAssignDialogOpen(false);
            setSelectedStaffUid('');
            setSelectedTemplateId('');
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Failed to assign template.'});
        } finally {
            setFormLoading(false);
        }
    };

    const staffWithoutOnboarding = staff.filter(s => !s.onboardingStatus);
    const staffWithOnboarding = staff.filter(s => !!s.onboardingStatus);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Digital Onboarding</CardTitle>
                        <CardDescription>Create onboarding checklists and track new staff progress.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                         <Button variant="outline" onClick={() => openTemplateDialog(null)}>Manage Templates</Button>
                         <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={templates.length === 0 || staffWithoutOnboarding.length === 0}><UserPlus className="mr-2 h-4 w-4"/> Start Onboarding</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Assign Onboarding Checklist</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                     <div className="space-y-1"><Label>Staff Member</Label><Select value={selectedStaffUid} onValueChange={setSelectedStaffUid}><SelectTrigger><SelectValue placeholder="Select staff..."/></SelectTrigger><SelectContent>{staffWithoutOnboarding.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                                     <div className="space-y-1"><Label>Onboarding Template</Label><Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}><SelectTrigger><SelectValue placeholder="Select template..."/></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                    <Button onClick={handleAssignTemplate} disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 animate-spin"/> : "Assign"}</Button>
                                </DialogFooter>
                            </DialogContent>
                         </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Checklist</TableHead>
                                <TableHead className="w-[200px]">Progress</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-20 w-full"/></TableCell></TableRow>
                            : staffWithOnboarding.length > 0 ? staffWithOnboarding.map(item => (
                                <TableRow key={item.uid}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.onboardingStatus?.templateName}</TableCell>
                                    <TableCell><Progress value={item.onboardingStatus?.progress || 0} /></TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No staff members are currently being onboarded.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => {if(!open) resetTemplateForm(); setIsTemplateDialogOpen(open);}}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Onboarding Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="space-y-1">
                            <Label htmlFor="template-name">Template Name</Label>
                            <Input id="template-name" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                        </div>
                        <Label>Checklist Tasks</Label>
                        <div className="space-y-2">
                        {tasks.map((task, index) => (
                            <div key={task.id} className="flex items-center gap-2">
                                <Input value={task.text} onChange={(e) => handleTaskChange(task.id, e.target.value)} placeholder={`Task ${index + 1}`}/>
                                <Button variant="ghost" size="icon" onClick={() => removeTask(task.id)} disabled={tasks.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                        </div>
                         <Button variant="outline" type="button" onClick={addTask}><PlusCircle className="mr-2 h-4 w-4"/>Add Task</Button>
                    </div>
                     <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveTemplate} disabled={formLoading}>{formLoading ? <Loader2 className="mr-2"/> : <Save className="mr-2 h-4"/>}Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
